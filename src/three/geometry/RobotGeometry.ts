import { BoxGeometry, CylinderGeometry, type BufferGeometry } from 'three'
import type { RobotType } from '../../data/sampleData'

/**
 * Returns a new BufferGeometry for the given robot type.
 * The caller (RobotMeshSet) is responsible for disposing it after
 * InstancedGeometry has cloned its data.
 */
export function createRobotGeometry(type: RobotType): BufferGeometry {
  switch (type) {
    case 'Box':
      return new BoxGeometry(0.6, 0.8, 0.6)
    case 'Cylinder':
      return new CylinderGeometry(0.3, 0.3, 0.8, 16)
    default: {
      const _exhaustive: never = type
      console.warn(`[RobotGeometry] unknown type: ${_exhaustive}`)
      return new BoxGeometry(0.6, 0.8, 0.6)
    }
  }
}

/**
 * Returns a slightly enlarged geometry for the outline mesh.
 * Pre-sized so the outline shader needs no per-vertex inflation,
 * avoiding artifacts on curved surfaces (Cylinder) and corners (Box).
 */
export function createOutlineGeometry(type: RobotType): BufferGeometry {
  const d = 0.05
  switch (type) {
    case 'Box':
      return new BoxGeometry(0.6 + d * 2, 0.8 + d * 2, 0.6 + d * 2)
    case 'Cylinder':
      return new CylinderGeometry(0.3 + d, 0.3 + d, 0.8 + d * 2, 16)
    default: {
      const _exhaustive: never = type
      console.warn(`[RobotGeometry] unknown outline type: ${_exhaustive}`)
      return new BoxGeometry(0.6 + d * 2, 0.8 + d * 2, 0.6 + d * 2)
    }
  }
}
