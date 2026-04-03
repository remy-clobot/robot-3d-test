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
