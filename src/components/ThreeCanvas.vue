<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'
import { worldToScreen, worldToScreen3D } from '../utils/coordinateSync'
import { RobotMeshSet } from '../three/RobotMeshSet'
import { createRobotGeometry } from '../three/geometry/RobotGeometry'
import { statusToNumber, type RobotType } from '../data/sampleData'

const appStore = useAppStore()
const mapStore = useMapStore()

const containerRef = ref<HTMLDivElement>()

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let pickingScene: THREE.Scene
let pickingTarget: THREE.WebGLRenderTarget
let camera: THREE.PerspectiveCamera
let controls: OrbitControls
let animationId: number
let needsRender = true
let cameraDirty = true

// One RobotMeshSet per geometry type
const meshSets = new Map<RobotType, RobotMeshSet>()
const ROBOT_TYPES: RobotType[] = ['Box', 'Cylinder']

// Picking: "meshTypeIndex:instanceIndex" → robots array index
const robotPickMap = new Map<string, number>()
const pixelBuffer = new Uint8Array(4)

// Drag detection — suppress pick when OrbitControls dragged
let pointerDownPos = { x: 0, y: 0 }

// ─── init ─────────────────────────────────────────────────────────────────────

function initScene() {
  const container = containerRef.value!
  const width = container.clientWidth
  const height = container.clientHeight
  appStore.containerWidth = width
  appStore.containerHeight = height

  // Picking scene + 1×1 render target
  pickingScene = new THREE.Scene()
  pickingScene.background = new THREE.Color(0xffffff) // white = no robot
  pickingTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  })

  // Renderer
  const pixelRatio = Math.min(window.devicePixelRatio, 2)
  renderer = new THREE.WebGLRenderer({
    antialias: pixelRatio < 2,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(0x1a1a2e, 1)
  container.appendChild(renderer.domElement)

  // Scene
  scene = new THREE.Scene()

  // Camera
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200)
  camera.position.set(0, 12, 10)
  camera.lookAt(0, 0, 0)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.1
  controls.maxPolarAngle = Math.PI / 2.1
  controls.addEventListener('change', () => {
    needsRender = true
    cameraDirty = true
  })

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(5, 10, 5)
  scene.add(dir)

  // Ground
  const grid = new THREE.GridHelper(20, 20, 0x444466, 0x333355)
  scene.add(grid)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x16213e, transparent: true, opacity: 0.5 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  scene.add(ground)

  // Robot mesh sets (one per geometry type)
  ROBOT_TYPES.forEach((type, index) => {
    const geo = createRobotGeometry(type)
    const meshSet = new RobotMeshSet(geo, {
      maxCount: 500,
      meshTypeIndex: index,
      enablePicking: true,
      enableErrorMarker: true,
    })
    meshSets.set(type, meshSet)
    meshSet.addToScene(scene, pickingScene)
  })

  // Populate instances from store
  for (let i = 0; i < mapStore.robots.length; i++) {
    const robot = mapStore.robots[i]
    const meshSet = meshSets.get(robot.type)
    if (!meshSet) continue
    const instanceIndex = meshSet.instanceCount
    robot.instanceIndex = instanceIndex
    meshSet.addInstance({
      translation: [robot.x, robot.y, robot.z],
      opacity0: 1.0,
      robotStatus: statusToNumber(robot.status),
      blink: robot.blink ? 1 : 0,
      outline: 0,
      errorMarker: robot.errorMarker ? 1 : 0,
      shadowDisc: robot.shadowDisc ? 1 : 0,
      instanceScale: [1, 1, 1],
    })
    // Build pick map: "meshTypeIndex:instanceIndex" → robots array index
    const typeIndex = ROBOT_TYPES.indexOf(robot.type)
    robotPickMap.set(`${typeIndex}:${instanceIndex}`, i)
  }
}

// ─── coordinate projection ───────────────────────────────────────────────────

function syncProjectedNodes() {
  const w = appStore.containerWidth
  const h = appStore.containerHeight

  for (const node of mapStore.nodes) {
    let pt = mapStore.projectedNodes.get(node.id)
    if (!pt) {
      pt = { x: 0, y: 0 }
      mapStore.projectedNodes.set(node.id, pt)
    }
    const s = worldToScreen(node.x, node.y, camera, w, h)
    pt.x = s.x
    pt.y = s.y
  }

  // Project robot label anchor (slightly above robot top: y + 0.9)
  for (const robot of mapStore.robots) {
    let pt = mapStore.projectedRobots.get(robot.id)
    if (!pt) {
      pt = { x: 0, y: 0 }
      mapStore.projectedRobots.set(robot.id, pt)
    }


    const s = worldToScreen3D(robot.x, robot.y + 0.5, robot.z, camera, w, h)
    // Mark off-screen / behind-camera with sentinels so LabelCanvas can skip cheaply
    pt.x = s.behindCamera ? -9999 : s.x
    pt.y = s.behindCamera ? -9999 : s.y
  }

  mapStore.projectedVersion++
}

// ─── GPU color-buffer picking ────────────────────────────────────────────────

/**
 * Render the picking scene to a 1×1 target at the given screen pixel,
 * read the color, and decode to a robots-array index.
 * Returns null if no robot was hit.
 */
function pickRobotByPoint(clientX: number, clientY: number): number | null {
  const container = containerRef.value!
  const rect = container.getBoundingClientRect()
  const pixelRatio = renderer.getPixelRatio()
  const x = Math.floor((clientX - rect.left) * pixelRatio)
  const y = Math.floor((clientY - rect.top) * pixelRatio)
  const fullW = Math.floor(rect.width * pixelRatio)
  const fullH = Math.floor(rect.height * pixelRatio)

  // Project only the clicked pixel
  camera.setViewOffset(fullW, fullH, x, y, 1, 1)
  renderer.setRenderTarget(pickingTarget)
  renderer.render(pickingScene, camera)
  renderer.readRenderTargetPixels(pickingTarget, 0, 0, 1, 1, pixelBuffer)
  renderer.setRenderTarget(null)
  camera.clearViewOffset()

  const r = pixelBuffer[0]
  const g = pixelBuffer[1]
  const b = pixelBuffer[2]

  // White background = no robot
  if (r === 255 && g === 255 && b === 255) return null

  const meshTypeIndex = r
  const instanceIndex = (g << 8) | b
  const key = `${meshTypeIndex}:${instanceIndex}`
  return robotPickMap.get(key) ?? null
}

/** Toggle selection — watcher handles GPU outline sync. */
function selectRobot(robotArrayIndex: number | null): void {
  const prev = appStore.selectedRobotId
  appStore.selectedRobotId = robotArrayIndex === prev ? null : robotArrayIndex
}

/**
 * Sync GPU instance attrs for one robot.
 * If the robot is currently selected, forces outline=1 regardless of stored value.
 */
function syncRobotAttrs(i: number): void {
  const robot = mapStore.robots[i]
  if (!robot || robot.instanceIndex === undefined) return
  const meshSet = meshSets.get(robot.type)
  if (!meshSet) return
  const isSelected = appStore.selectedRobotId === i
  meshSet.setInstanceAttrs(robot.instanceIndex, {
    robotStatus: statusToNumber(robot.status),
    blink: robot.blink ? 1 : 0,
    outline: isSelected ? 1 : 0,
    errorMarker: robot.errorMarker ? 1 : 0,
    shadowDisc: robot.shadowDisc ? 1 : 0,
  })
  needsRender = true
}

// When selectedRobotId changes, update the GPU outline for prev + next robot
watch(
  () => appStore.selectedRobotId,
  (next, prev) => {
    if (prev !== null) syncRobotAttrs(prev)
    if (next !== null) syncRobotAttrs(next)
    needsRender = true
  },
)

// When any robot's data changes (via RobotPanel), re-sync that robot's GPU attrs
watch(
  () => mapStore.robotVersion,
  () => {
    for (let i = 0; i < mapStore.robots.length; i++) syncRobotAttrs(i)
  },
)

// ─── animation loop ───────────────────────────────────────────────────────────

function animate() {
  animationId = requestAnimationFrame(animate)
  if (appStore.mode !== 'monitoring') return

  controls.update()

  // Force continuous render while blink effects are active
  if (mapStore.robots.some((r) => r.blink)) needsRender = true

  if (!needsRender) return

  // Update time uniform for blink & error-marker pulse
  const t = performance.now() / 1000
  meshSets.forEach((set) => set.tickTime(t))

  renderer.render(scene, camera)

  // Re-project node positions only when camera actually moved
  if (cameraDirty) {
    syncProjectedNodes()
    cameraDirty = false
  }

  needsRender = false
}

// ─── resize ──────────────────────────────────────────────────────────────────

function onResize() {
  const container = containerRef.value
  if (!container) return
  const w = container.clientWidth
  const h = container.clientHeight
  appStore.containerWidth = w
  appStore.containerHeight = h
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  needsRender = true
  cameraDirty = true
}

// ─── click picking ────────────────────────────────────────────────────────────

function onPointerDown(e: PointerEvent) {
  pointerDownPos = { x: e.clientX, y: e.clientY }
}

function onPointerUp(e: PointerEvent) {
  if (appStore.mode !== 'monitoring') return
  const dx = e.clientX - pointerDownPos.x
  const dy = e.clientY - pointerDownPos.y
  // Suppress pick if pointer moved more than 4px (OrbitControls drag)
  if (Math.sqrt(dx * dx + dy * dy) > 4) return
  const hit = pickRobotByPoint(e.clientX, e.clientY)
  selectRobot(hit)
}

// ─── mode switch ──────────────────────────────────────────────────────────────

watch(
  () => appStore.mode,
  (mode) => {
    if (mode === 'monitoring') {
      controls.enabled = true
      renderer.domElement.style.display = 'block'
      needsRender = true
      cameraDirty = true
    } else {
      controls.enabled = false
      renderer.domElement.style.display = 'none'
    }
  },
)

// ─── lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  initScene()
  animate()
  window.addEventListener('resize', onResize)
  const el = containerRef.value!
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointerup', onPointerUp)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  const el = containerRef.value
  if (el) {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointerup', onPointerUp)
  }
  meshSets.forEach((set) => set.dispose())
  meshSets.clear()
  controls.dispose()
  pickingTarget.dispose()
  renderer.dispose()
})
</script>

<template>
  <div ref="containerRef" class="three-container" />
</template>

<style scoped>
.three-container {
  position: absolute;
  inset: 0;
}
</style>
