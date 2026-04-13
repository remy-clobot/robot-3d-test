<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as THREE from 'three'
import { useAppStore } from '../stores/appStore'
import { MAP_META } from '../data/sampleData'
import mapImageUrl from '../../refs/map_250214.png'

const appStore = useAppStore()
const containerRef = ref<HTMLDivElement>()

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene | null = null
let mapOverlayMesh: THREE.Mesh | null = null

function initMapScene() {
  const container = containerRef.value!
  const width  = container.clientWidth
  const height = container.clientHeight

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, stencil: false })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ color: 0x16213e, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  ground.frustumCulled = false
  ground.renderOrder = 1
  scene.add(ground)

  // Map image overlay plane
  const { resolution, origin, imageSize } = MAP_META
  const mapTexture = new THREE.TextureLoader().load(mapImageUrl, () => {
    // 텍스처 로드 완료 시 한 번 강제 렌더
    renderMapFrame()
  })
  mapTexture.colorSpace = THREE.SRGBColorSpace
  mapOverlayMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(
      imageSize.width  * resolution,
      imageSize.height * resolution,
    ),
    new THREE.MeshBasicMaterial({
      map: mapTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  mapOverlayMesh.rotation.x = -Math.PI / 2
  mapOverlayMesh.position.set(
    origin.x + (imageSize.width  * resolution) / 2,
    0.005,
    origin.y + (imageSize.height * resolution) / 2,
  )
  mapOverlayMesh.frustumCulled = false
  mapOverlayMesh.renderOrder = 0
  scene.add(mapOverlayMesh)
}

function renderMapFrame() {
  if (!scene) return
  const cam = appStore.threeCamera
  if (!cam) return
  renderer.render(scene, cam)
}

onMounted(() => {
  initMapScene()
})

// ThreeCanvas animate() 매 프레임 호출 → 카메라 업데이트 후 동기 렌더
watch(() => appStore.renderFrameCount, renderMapFrame, { flush: 'sync' })

// 맵 이미지 토글
watch(() => appStore.mapImageVisible, (v) => {
  if (mapOverlayMesh) mapOverlayMesh.visible = v
  renderMapFrame()
})

// 리사이즈
watch(
  () => [appStore.containerWidth, appStore.containerHeight] as const,
  ([w, h]) => {
    renderer?.setSize(w, h)
    renderMapFrame()
  },
)
</script>

<template>
  <div ref="containerRef" class="three-map-canvas" />
</template>

<style scoped>
.three-map-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
