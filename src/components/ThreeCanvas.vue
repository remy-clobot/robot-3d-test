<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'
import { worldToScreen, worldToScreen3D } from '../utils/coordinateSync'
import { RobotMeshSet } from '../three/RobotMeshSet'
import { createRobotGeometry, createOutlineGeometry } from '../three/geometry/RobotGeometry'
import { statusToNumber, type RobotType } from '../data/sampleData'
import { loadBinPointCloud, POINT_HEIGHT_RANGE } from '../data/pointCloudData'
import { sampleTasks } from '../data/sampleTasks'

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
let focusRafId: number | null = null
const FOCUS_DURATION = 700 // ms

let pointCloudPoints: THREE.Points | null = null

// ─── heading arrows ───────────────────────────────────────────────────────────
const robotArrows: THREE.LineSegments[] = []
let   arrowMat:    THREE.LineBasicMaterial | null = null

// ─── task 3D markers (pins only — path drawn by Konva) ───────────────────────
let taskStartPin: THREE.Group | null = null
let taskEndPin:   THREE.Group | null = null

function createPinMesh(color: number): THREE.Group {
  const group = new THREE.Group()
  const mat = new THREE.MeshPhongMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.3),
    transparent: true,
    opacity: 0.92,
  })
  // Cone body — tip at y=0, base at y=0.6 (pointing down via rotation)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 12), mat.clone())
  cone.rotation.x = Math.PI
  cone.position.y = 0.3
  // Sphere head
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat.clone())
  sphere.position.y = 0.65
  group.add(cone)
  group.add(sphere)
  group.visible = false
  return group
}

function updateTask3DMarkers(): void {
  const taskId = appStore.selectedTaskId
  const show   = taskId !== null && mapStore.taskTooltipMode === '3d'

  if (taskStartPin) taskStartPin.visible = show
  if (taskEndPin)   taskEndPin.visible   = show

  if (show) {
    const task = sampleTasks.find(t => t.id === taskId)
    if (task && task.pathList.length >= 2) {
      const startPt = task.pathList[0]
      const endPt   = task.pathList[task.pathList.length - 1]
      if (taskStartPin) taskStartPin.position.set(startPt.x, 0, startPt.y)
      if (taskEndPin)   taskEndPin.position.set(endPt.x, 0, endPt.y)
    }
  }

  needsRender = true
}

// One RobotMeshSet per geometry type
const meshSets = new Map<RobotType, RobotMeshSet>()
const ROBOT_TYPES: RobotType[] = ['Box', 'Cylinder']

// Picking: "meshTypeIndex:instanceIndex" → robots array index
const robotPickMap = new Map<string, number>()
const pixelBuffer = new Uint8Array(4)

// Drag detection — suppress pick when OrbitControls dragged
let pointerDownPos    = { x: 0, y: 0 }
let pointerDownButton = -1

// ─── heading arrow geometry (refs/3d-arrow.ts 기반, XZ 평면으로 변환) ────────
//
// 참조 파일의 getArrowInfo()는 XY 평면에서 +X 방향 화살표를 정의함.
// Three.js 그라운드 플레인은 XZ 이므로, 날개를 Y 대신 Z 방향으로 배치.
// 인덱스 구조(LineSegments): shaft[0→1], wing1[1→2], wing2[1→3]

function createArrowGeometry(): THREE.BufferGeometry {
  const shaftStart = 0.3   // 로봇 중심에서 화살표 시작 오프셋
  const tip        = 0.8   // 화살촉 끝 X
  const wingX      = 0.6   // 날개 부착 X (tip에서 뒤쪽)
  const wingZ      = 0.2   // 날개 너비 (±Z)

  // XZ 평면 배치: 날개 방향을 Y → Z 로 변환 (참조 파일의 arrowWidth → wingZ)
  const positions = new Float32Array([
    shaftStart, 0,  0,      // 0: 샤프트 시작
    tip,        0,  0,      // 1: 화살촉 끝
    wingX,      0,  wingZ,  // 2: 날개 +Z
    wingX,      0, -wingZ,  // 3: 날개 -Z
  ])

  const geo = new THREE.BufferGeometry()
  geo.setIndex([0, 1, 1, 2, 1, 3])
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geo
}

function syncArrows(): void {
  for (let i = 0; i < robotArrows.length; i++) {
    const arrow = robotArrows[i]
    const robot = mapStore.robots[i]
    if (!arrow || !robot) continue
    arrow.position.set(robot.x, robot.y + 0.05, robot.z)
    arrow.rotation.y = robot.rotationY ? robot.rotationY - Math.PI/2:  0
    //arrow.rotation.y = Math.PI/2

  }
  needsRender = true
}

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
    alpha: true,
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)

  // Scene
  scene = new THREE.Scene()

  // Camera
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200)
  camera.position.set(0, 12, 10)
  camera.lookAt(0, 0, 0)
  appStore.setThreeCamera(camera)

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

  // 헤딩 화살표 (로봇별 1개, 공유 재질)
  arrowMat = new THREE.LineBasicMaterial({ color: 0x999999 })
  for (const robot of mapStore.robots) {
    const arrow = new THREE.LineSegments(createArrowGeometry(), arrowMat)
    arrow.position.set(robot.x, robot.y + 0.05, robot.z)
    arrow.rotation.y = robot.rotationY ?? 0
    scene.add(arrow)
    robotArrows.push(arrow)
  }

  // Task 3D pins (hidden until a task is selected in 3D mode)
  taskStartPin = createPinMesh(0x2563eb) // blue  — start
  taskEndPin   = createPinMesh(0xef4444) // red   — end
  scene.add(taskStartPin)
  scene.add(taskEndPin)

  // Point cloud loaded asynchronously after initScene()

  // Robot mesh sets (one per geometry type)
  ROBOT_TYPES.forEach((type, index) => {
    const geo = createRobotGeometry(type)
    const outlineGeo = createOutlineGeometry(type)
    const meshSet = new RobotMeshSet(geo, {
      maxCount: 500,
      meshTypeIndex: index,
      enablePicking: true,
      enableErrorMarker: true,
      outlineGeometry: outlineGeo,
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

// ─── point cloud ─────────────────────────────────────────────────────────────

const POINT_VERT = /* glsl */`
  precision mediump float;
  attribute vec3 position;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float minHeight;
  uniform float maxHeight;
  varying vec3 vColor;

  vec3 heightColor(float t) {
    if (t < 0.25) return mix(vec3(0.05, 0.10, 0.75), vec3(0.00, 0.80, 0.90), t * 4.0);
    if (t < 0.50) return mix(vec3(0.00, 0.80, 0.90), vec3(0.10, 0.85, 0.10), (t - 0.25) * 4.0);
    if (t < 0.75) return mix(vec3(0.10, 0.85, 0.10), vec3(0.95, 0.85, 0.00), (t - 0.50) * 4.0);
                  return mix(vec3(0.95, 0.85, 0.00), vec3(0.95, 0.10, 0.05), (t - 0.75) * 4.0);
  }

  void main() {
    float t = clamp((position.y - minHeight) / (maxHeight - minHeight), 0.0, 1.0);
    vColor = heightColor(t);
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 2.0;
  }
`

const POINT_FRAG = /* glsl */`
  precision mediump float;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 0.85);
  }
`

async function addPointCloud() {
  const positions = await loadBinPointCloud()

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const mat = new THREE.RawShaderMaterial({
    vertexShader:   POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: {
      minHeight: { value: POINT_HEIGHT_RANGE.min },
      maxHeight: { value: POINT_HEIGHT_RANGE.max },
    },
    transparent: true,
    depthWrite:  false,
  })

  pointCloudPoints = new THREE.Points(geo, mat)
  pointCloudPoints.visible = appStore.pointCloudVisible
  scene.add(pointCloudPoints)
  needsRender = true
}

// ─── coordinate projection ───────────────────────────────────────────────────

function syncProjectedNodes() {
  const w = appStore.containerWidth
  const h = appStore.containerHeight


  // 카메라가 현재 바라보는 중심(Target)
  const tx = controls.target.x
  const tz = controls.target.z

  // 1. 아주 작은 변화량(Delta)을 정의합니다.
  // 타원의 순수한 찌그러짐(Pitch에 의한 왜곡)만 추출하려면 투영에 사용하는두 점을 원점에 아주 미세하게 가깝게 두어, 심도(Depth) 변화에 따른 오차를 제거해야함
  // 수학적으로는 점 간 차이를 구하는 것에서 순간 변화률을 구하는 방식으로 바꾸는 것
  const DELTA = 0.001

// 2. 1 대신 DELTA만큼만 이동한 좌표를 투영합니다.
  const p0  = worldToScreen(tx, tz, camera, w, h)
  const p1x = worldToScreen(tx + DELTA, tz, camera, w, h)
  const p1z = worldToScreen(tx, tz + DELTA, camera, w, h)

// 3. 차이를 구한 뒤, DELTA로 나누어 다시 1단위 기준의 스케일(기울기)로 복원합니다.
  const ux = (p1x.x - p0.x) / DELTA
  const uy = (p1x.y - p0.y) / DELTA
  const vx = (p1z.x - p0.x) / DELTA
  const vy = (p1z.y - p0.y) / DELTA

// 이후 로직(A, B, C 계산 및 고유값 분해)은 그대로 유지합니다.
  const A    = ux*ux + vx*vx
  const B    = ux*uy + vx*vy
  const C    = uy*uy + vy*vy
  const disc = Math.sqrt((A - C) * (A - C) + 4 * B * B)

  appStore.mapEllipseRadiusX  = Math.sqrt(Math.max(0, (A + C + disc) / 2)) // 장축
  appStore.mapEllipseRadiusY  = Math.sqrt(Math.max(0, (A + C - disc) / 2)) // 단축
  appStore.mapEllipseRotation = Math.atan2(2 * B, A - C) / 2 * (180 / Math.PI)
  appStore.mapScale            = appStore.mapEllipseRadiusX  // zoom 지표

  for (const node of mapStore.nodes) {
    let pt = mapStore.projectedNodes.get(node.id)
    if (!pt) {
      pt = { x: 0, y: 0 }
      mapStore.projectedNodes.set(node.id, pt)
    }

    const s = worldToScreen(node.x, node.y, camera, w, h)

    pt.x = s.behindCamera ? -9999 : s.x
    pt.y = s.behindCamera ? -9999 : s.y
  }

  // Project robot label anchor (slightly above robot top: y + 0.9)
  for (const robot of mapStore.robots) {
    let pt = mapStore.projectedRobots.get(robot.id)
    if (!pt) {
      pt = { x: 0, y: 0 }
      mapStore.projectedRobots.set(robot.id, pt)
    }


    const s = worldToScreen3D(robot.x, robot.y + 0.4, robot.z, camera, w, h)
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

  console.log('pickRobotByPoint 호출');
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
    translation: [robot.x, robot.y, robot.z],
    rotationY:   robot.rotationY ?? 0,
    robotStatus: statusToNumber(robot.status),
    blink:        robot.blink ? 1 : 0,
    outline:      isSelected && appStore.outlineVisible ? 1 : 0,
    errorMarker:  robot.errorMarker ? 1 : 0,
    shadowDisc:   isSelected ? 1 : (robot.shadowDisc ? 1 : 0),
  })
  needsRender = true
}

watch(
  () => appStore.pointCloudVisible,
  (v) => {
    if (pointCloudPoints) pointCloudPoints.visible = v
    needsRender = true
  },
)



// 로봇/태스크 클릭 시 카메라 부드럽게 이동
watch(
  () => appStore.cameraFocusVersion,
  () => {
    const target = appStore.cameraFocusTarget
    if (!target || !controls) return

    if (focusRafId !== null) {
      cancelAnimationFrame(focusRafId)
      focusRafId = null
    }

    const startTX = controls.target.x
    const startTZ = controls.target.z
    const startCX = camera.position.x
    const startCZ = camera.position.z
    const dX = target.x - startTX
    const dZ = target.z - startTZ
    const t0 = performance.now()

    function step(now: number) {
      const p = Math.min((now - t0) / FOCUS_DURATION, 1)
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2

      controls.target.x = startTX + dX * e
      controls.target.z = startTZ + dZ * e
      camera.position.x = startCX + dX * e
      camera.position.z = startCZ + dZ * e

      needsRender = true
      cameraDirty = true

      if (p < 1) {
        focusRafId = requestAnimationFrame(step)
      } else {
        focusRafId = null
        controls.update()
      }
    }

    focusRafId = requestAnimationFrame(step)
  },
)

// When selectedRobotId changes, update the GPU outline for prev + next robot
watch(
  () => appStore.selectedRobotId,
  (next, prev) => {
    if (prev !== null) syncRobotAttrs(prev)
    if (next !== null) syncRobotAttrs(next)
    needsRender = true
  },
)

// When any robot's data changes (via RobotPanel / playback), re-sync GPU attrs + re-project labels
watch(
  () => mapStore.robotVersion,
  () => {
    for (let i = 0; i < mapStore.robots.length; i++) syncRobotAttrs(i)
    syncArrows()
    cameraDirty = true   // 로봇 위치 변경 → 라벨 좌표 재투영
  },
)

// Task 3D markers: update when selected task or tooltip mode changes
watch(
  [() => appStore.selectedTaskId, () => mapStore.taskTooltipMode],
  () => updateTask3DMarkers(),
)

// ─── animation loop ───────────────────────────────────────────────────────────

function animate() {
  animationId = requestAnimationFrame(animate)
  if (appStore.mode !== 'monitoring') {
    appStore.bumpRenderFrame()
    return
  }

  controls.update()
  appStore.bumpRenderFrame()          // controls.update() 후 → ThreeMapCanvas가 최신 카메라로 렌더

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
  pointerDownPos    = { x: e.clientX, y: e.clientY }
  pointerDownButton = e.button

  const azimuth = controls.getAzimuthalAngle()                // radians, 0 = +Z축 방향
  const polar   = controls.getPolarAngle()                    // radians, 0 = 정상위(top-down)

  const bearing = (((-azimuth * 180) / Math.PI) % 360 + 360) % 360  // 0~360°, 북쪽 기준 시계방향
  const pitch   = 90 - (polar * 180) / Math.PI                       // 0° = 수평, 90° = 정상위

  console.log(`bearing: ${bearing.toFixed(1)}°  pitch: ${pitch.toFixed(1)}°`)
}

function onPointerUp(e: PointerEvent) {
  if (appStore.mode !== 'monitoring') return
  // Only react when both down and up are left-click (button === 0)
  if (e.button !== 0 || pointerDownButton !== 0) return
  pointerDownButton = -1
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

onMounted(async () => {
  initScene()
  animate()
  addPointCloud()   // async, 로드 완료 후 자동으로 씬에 추가됨
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
  robotArrows.forEach((a) => { a.geometry.dispose(); scene.remove(a) })
  robotArrows.length = 0
  arrowMat?.dispose()
  if (pointCloudPoints) {
    pointCloudPoints.geometry.dispose()
    ;(pointCloudPoints.material as THREE.Material).dispose()
    scene.remove(pointCloudPoints)
  }
  // Task 3D pin cleanup
  const disposePinGroup = (g: THREE.Group) => {
    scene.remove(g)
    g.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
    })
  }
  if (taskStartPin) disposePinGroup(taskStartPin)
  if (taskEndPin)   disposePinGroup(taskEndPin)

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
