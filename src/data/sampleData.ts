// ─── map data types ───────────────────────────────────────────────────────────

export interface MapNode {
  id: number
  x: number
  y: number
  label?: string
}

export interface MapLink {
  id: number
  from: number
  to: number
}

// ─── robot types ──────────────────────────────────────────────────────────────

export type RobotType   = 'Box' | 'Cylinder'
export type RobotStatus = 'normal' | 'warning' | 'error'

export interface Robot {
  id: number
  type: RobotType
  x: number
  y: number
  z: number
  status: RobotStatus
  /** Blink effect on/off — independent of status */
  blink: boolean
  /** Error marker sphere on/off — independent of status */
  errorMarker: boolean
  /** Shadow disc on ground plane on/off */
  shadowDisc: boolean
  /** Set by ThreeCanvas after addInstance(); do not set manually */
  instanceIndex?: number
}

// ─── sample data ──────────────────────────────────────────────────────────────

export const sampleNodes: MapNode[] = [
  { id: 1, x: -3, y: -3, label: 'A' },
  { id: 2, x:  3, y: -3, label: 'B' },
  { id: 3, x:  3, y:  3, label: 'C' },
  { id: 4, x: -3, y:  3, label: 'D' },
  { id: 5, x:  0, y:  0, label: 'E' },
]

export const sampleLinks: MapLink[] = [
  { id: 1, from: 1, to: 2 },
  { id: 2, from: 2, to: 3 },
  { id: 3, from: 3, to: 4 },
  { id: 4, from: 4, to: 1 },
]

export const sampleRobots: Robot[] = [
  { id: 1, type: 'Box',      x: -2,   y: 0.4, z: -2,   status: 'normal',  blink: false, errorMarker: false, shadowDisc: false },
  { id: 2, type: 'Box',      x:  2,   y: 0.4, z:  0,   status: 'warning', blink: false, errorMarker: false, shadowDisc: false },
  { id: 3, type: 'Cylinder', x:  0,   y: 0.4, z:  2,   status: 'error',   blink: false, errorMarker: false, shadowDisc: false },
  { id: 4, type: 'Cylinder', x: -1.5, y: 0.4, z:  1,   status: 'normal',  blink: false, errorMarker: false, shadowDisc: false },
  { id: 5, type: 'Box',      x:  1,   y: 0.4, z: -1.5, status: 'warning', blink: false, errorMarker: false, shadowDisc: false },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

export function statusToNumber(status: RobotStatus): number {
  return status === 'normal' ? 0 : status === 'warning' ? 1 : 2
}
