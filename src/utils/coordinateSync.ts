import * as THREE from 'three'

const _vec3 = new THREE.Vector3()

/**
 * Three.js 월드 좌표(XZ 평면) → 스크린 픽셀 좌표 변환
 * 노드의 2D (x, y) → Three.js (x, 0, y) 로 매핑
 */
export function worldToScreen(
  worldX: number,
  worldZ: number,
  camera: THREE.Camera,
  width: number,
  height: number,
): { x: number; y: number } {
  _vec3.set(worldX, 0, worldZ)
  _vec3.project(camera)
  return {
    x: (_vec3.x * 0.5 + 0.5) * width,
    y: (-_vec3.y * 0.5 + 0.5) * height,
  }
}
