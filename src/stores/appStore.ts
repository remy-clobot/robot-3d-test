import { defineStore } from 'pinia'
import {ref, markRaw, watch} from 'vue'
import type * as THREE from 'three'

export type AppMode = 'monitoring' | 'editing'

export const useAppStore = defineStore('app', () => {
  const mode = ref<AppMode>('monitoring')
  const containerWidth = ref(800)
  const containerHeight = ref(600)

  const selectedRobotId    = ref<number | null>(null)
  const selectedTaskId     = ref<string | null>(null)

  const pointCloudVisible  = ref(true)
  const mapImageVisible    = ref(true)
  const outlineVisible     = ref(true)
  /** 현재 Three.js 카메라 기준 픽셀/월드단위 스케일 (syncProjectedNodes에서 갱신) */
  const mapScale           = ref(30)  // 장축 크기 (zoom 지표 — 폰트/선 두께 등에 사용)
  const mapEllipseRadiusX  = ref(30)  // 고유값 분해: 장축 반지름 (per world unit)
  const mapEllipseRadiusY  = ref(30)  // 고유값 분해: 단축 반지름 (per world unit)
  const mapEllipseRotation = ref(0)   // 고유값 분해: 장축 방향각 (도, Konva rotation 용)

  /** 공유 카메라 (ThreeCanvas가 설정, ThreeMapCanvas가 읽음) */
  const threeCamera = ref<THREE.PerspectiveCamera | null>(null)
  /** ThreeCanvas animate() 매 프레임 증가 → ThreeMapCanvas 동기 렌더 트리거 */
  const renderFrameCount = ref(0)

  /** 카메라 포커스 요청 (TaskPanel 클릭 등에서 설정) */
  const cameraFocusTarget  = ref<{ x: number; z: number } | null>(null)
  const cameraFocusVersion = ref(0)

  // 로봇, 태스크 상호 배제
  watch(selectedRobotId, (newVal) => {
    if (newVal !== null) {
      selectedTaskId.value = null
    }
  })
  watch(selectedTaskId, (newVal) => {
    if (newVal !== null) {
      selectedRobotId.value = null
    }
  })

  function toggleMode() {
    mode.value = mode.value === 'monitoring' ? 'editing' : 'monitoring'
  }

  function setThreeCamera(cam: THREE.PerspectiveCamera) {
    threeCamera.value = markRaw(cam)
  }

  function bumpRenderFrame() {
    renderFrameCount.value++
  }

  function focusCamera(x: number, z: number) {
    cameraFocusTarget.value = { x, z }
    cameraFocusVersion.value++
  }

  return {
    mode, containerWidth, containerHeight, selectedRobotId, selectedTaskId,
    pointCloudVisible, mapImageVisible, outlineVisible,
    mapScale, mapEllipseRadiusX, mapEllipseRadiusY, mapEllipseRotation,
    threeCamera, renderFrameCount,
    cameraFocusTarget, cameraFocusVersion,
    toggleMode, setThreeCamera, bumpRenderFrame, focusCamera,
  }
})
