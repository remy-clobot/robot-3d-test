// ─── map meta info ────────────────────────────────────────────────────────────

export const MAP_META = {
  resolution: 0.05,
  origin: { x: -10.650000000000002, y: -10.299999000000003 },
  imageSize: { width: 899, height: 656 },
} as const

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

export type LabelType   = 'default' | 'custom'
export type TooltipType = 'tooltip1' | 'tooltip2'

export interface Robot {
  id: number
  type: RobotType
  x: number
  y: number
  z: number
  /** Y축 회전 (라디안). 플레이백 등 외부에서 갱신 가능. */
  rotationY?: number
  status: RobotStatus
  /** Work progress percentage 0–100 (used by custom label) */
  workProgress: number
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
//
//  Map data from refs/nodes.txt + refs/links.txt
//  107 nodes, 138 links  (coordinate range x:[-19, 24], y:[-3, 20])

export const sampleNodes: MapNode[] = [
  { id: 1, x: 3.541, y: 18.04, label: '용접A' },
  { id: 2, x: 7.63, y: 19.35 },
  { id: 3, x: 10.26, y: 19.35 },
  { id: 4, x: 9.56, y: 6.35 },
  { id: 5, x: 7.15, y: 6.35 },
  { id: 6, x: 5.51, y: 6.35 },
  { id: 7, x: 3.85, y: 6.35 },
  { id: 8, x: 2.19, y: 6.35 },
  { id: 9, x: 12.865, y: 6.28 },
  { id: 10, x: 16.93, y: 6.35 },
  { id: 11, x: 18.56, y: 6.35 },
  { id: 12, x: 20.21, y: 6.35 },
  { id: 13, x: 21.86, y: 6.35 },
  { id: 14, x: 21.894, y: 4.5, label: 'B10' },
  { id: 15, x: 21.894, y: 2.3, label: 'A10' },
  { id: 16, x: 21.894, y: 0.4 },
  { id: 17, x: 20.22, y: 0.4 },
  { id: 18, x: 18.59, y: 0.4 },
  { id: 19, x: 16.96, y: 0.4 },
  { id: 20, x: 12.86, y: 0.77 },
  { id: 21, x: 11.21, y: 0.77 },
  { id: 22, x: 9.55, y: 0.77 },
  { id: 23, x: 7.15, y: 0.77 },
  { id: 24, x: 5.48, y: 0.77 },
  { id: 25, x: 3.86, y: 0.77 },
  { id: 26, x: 2.16, y: 0.77 },
  { id: 27, x: 2.2, y: 2.65, label: 'A1' },
  { id: 28, x: 2.2, y: 4.47, label: 'B1' },
  { id: 29, x: 3.85, y: 2.65, label: 'A2' },
  { id: 30, x: 3.85, y: 4.47, label: 'B2' },
  { id: 31, x: 5.49, y: 2.65, label: 'A3' },
  { id: 32, x: 5.49, y: 4.47, label: 'B3' },
  { id: 33, x: 15.29, y: 7.967, label: '조립A 도킹인' },
  { id: 34, x: 15.27, y: 10.425, label: '조립A' },
  { id: 35, x: 17.371, y: 10.386, label: '조립B' },
  { id: 36, x: 20, y: -3, label: '가공3 OUT' },
  { id: 37, x: 19.98, y: -0.976, label: '가공3 OUT 도킹인' },
  { id: 38, x: 21.914, y: -2.975, label: '가공3 IN' },
  { id: 39, x: 21.89, y: -0.976, label: '가공3 IN 도킹인' },
  { id: 40, x: 13.438, y: -3.286, label: '가공1 IN' },
  { id: 41, x: 13.438, y: -0.976, label: '가공2 IN 도킹인' },
  { id: 42, x: 11.441, y: -3.226, label: '가공1 OUT' },
  { id: 43, x: 11.441, y: -0.976, label: '가공2 OUT 도킹인' },
  { id: 44, x: 4.497, y: -3.351, label: '가공2 IN' },
  { id: 45, x: 4.497, y: -0.976, label: '가공1 IN 도킹인' },
  { id: 46, x: 2.49, y: -3.325, label: '가공2 OUT' },
  { id: 47, x: 2.49, y: -0.976, label: '가공1 OUT 도킹인' },
  { id: 48, x: 20.24, y: 4.5, label: 'B9' },
  { id: 49, x: 20.24, y: 2.3, label: 'A9' },
  { id: 50, x: 18.6, y: 4.5, label: 'B8' },
  { id: 51, x: 18.6, y: 2.3, label: 'A8' },
  { id: 52, x: 16.95, y: 4.5, label: 'B7' },
  { id: 53, x: 16.95, y: 2.3, label: 'A7' },
  { id: 54, x: 12.856, y: 4.464, label: 'B6' },
  { id: 55, x: 12.864, y: 2.689, label: 'A6' },
  { id: 56, x: 11.25, y: 2.65, label: 'A5' },
  { id: 57, x: 11.25, y: 4.47, label: 'B5' },
  { id: 58, x: 11.24, y: 6.35 },
  { id: 59, x: 9.58, y: 4.47, label: 'B4' },
  { id: 60, x: 9.58, y: 2.65, label: 'A4' },
  { id: 61, x: 5.466, y: 15.967, label: '용접B' },
  { id: 62, x: 7.15, y: 4.47, label: 'B11' },
  { id: 63, x: 7.15, y: 2.65, label: 'A11' },
  { id: 64, x: 10.269, y: 16.459 },
  { id: 65, x: 10.269, y: 12.976 },
  { id: 66, x: 10.269, y: 10.4 },
  { id: 67, x: 17.371, y: 7.967, label: '조립B 도킹인' },
  { id: 68, x: 23.7, y: 3.8, label: '조립충전' },
  { id: 69, x: 23.7, y: 1.5 },
  { id: 70, x: 14.65, y: 0.77 },
  { id: 71, x: 14.65, y: 2.689, label: 'A12' },
  { id: 72, x: 14.65, y: 4.464, label: 'B12' },
  { id: 73, x: 5.53, y: 18.6 },
  { id: 74, x: 0.154, y: -3.325, label: '가공2' },
  { id: 75, x: 8.852, y: -3.226, label: '가공1' },
  { id: 76, x: 17.836, y: -3, label: '가공3' },
  { id: 77, x: 19.764, y: 10.4, label: '조립' },
  { id: 78, x: 1.512, y: 18.033, label: '용접' },
  { id: 79, x: 5.6, y: 18.033 },
  { id: 80, x: 6, y: 19.35 },
  { id: 81, x: 10.27, y: 18.431 },
  { id: 82, x: 12.315, y: 18.431, label: '용접충전' },
  { id: 83, x: 8.063, y: 7.967 },
  { id: 84, x: 14.65, y: 6.35 },
  { id: 85, x: 8.34, y: -0.054 },
  { id: 86, x: 15.83, y: -0.176 },
  { id: 87, x: -0.5, y: 3.237 },
  { id: 88, x: 23.7, y: 2.5, label: '가공충전' },
  { id: 89, x: 23.7, y: 5.064 },
  { id: 90, x: -17.449, y: 3.437 },
  { id: 91, x: -15.135, y: 3.474 },
  { id: 92, x: -12.748, y: 3.51 },
  { id: 93, x: -10.507, y: 3.437 },
  { id: 94, x: -8.266, y: 3.437 },
  { id: 95, x: -12.821, y: 1.527 },
  { id: 96, x: -12.763, y: -2.13 },
  { id: 97, x: -15.563, y: -2.056 },
  { id: 98, x: -18.032, y: -1.909 },
  { id: 99, x: -13.449, y: 10.793 },
  { id: 100, x: -7.812, y: 10.74 },
  { id: 101, x: -7.785, y: 8.905 },
  { id: 102, x: -13.503, y: 9.04 },
  { id: 103, x: -19.276, y: 9.121 },
  { id: 104, x: -19.357, y: 10.766 },
  { id: 105, x: -17.476, y: 5.42 },
  { id: 106, x: -12.786, y: 5.5 },
  { id: 107, x: -8.107, y: 5.511 },
]

export const sampleLinks: MapLink[] = [
  { id: 1, from: 3, to: 2 },
  { id: 2, from: 9, to: 54 },
  { id: 3, from: 64, to: 65 },
  { id: 4, from: 65, to: 66 },
  { id: 5, from: 8, to: 28 },
  { id: 6, from: 7, to: 30 },
  { id: 7, from: 6, to: 32 },
  { id: 8, from: 4, to: 59 },
  { id: 9, from: 58, to: 57 },
  { id: 10, from: 28, to: 27 },
  { id: 11, from: 27, to: 26 },
  { id: 12, from: 30, to: 29 },
  { id: 13, from: 29, to: 25 },
  { id: 14, from: 32, to: 31 },
  { id: 15, from: 31, to: 24 },
  { id: 16, from: 60, to: 22 },
  { id: 17, from: 56, to: 21 },
  { id: 18, from: 55, to: 20 },
  { id: 19, from: 10, to: 52 },
  { id: 20, from: 53, to: 19 },
  { id: 21, from: 11, to: 50 },
  { id: 22, from: 51, to: 18 },
  { id: 23, from: 12, to: 48 },
  { id: 24, from: 49, to: 17 },
  { id: 25, from: 13, to: 14 },
  { id: 26, from: 15, to: 16 },
  { id: 27, from: 35, to: 67 },
  { id: 28, from: 62, to: 5 },
  { id: 29, from: 63, to: 62 },
  { id: 30, from: 23, to: 63 },
  { id: 31, from: 71, to: 70 },
  { id: 32, from: 19, to: 18 },
  { id: 33, from: 18, to: 17 },
  { id: 34, from: 17, to: 16 },
  { id: 35, from: 43, to: 41 },
  { id: 36, from: 47, to: 45 },
  { id: 37, from: 47, to: 46 },
  { id: 38, from: 45, to: 44 },
  { id: 39, from: 43, to: 42 },
  { id: 40, from: 41, to: 40 },
  { id: 41, from: 37, to: 36 },
  { id: 42, from: 39, to: 38 },
  { id: 43, from: 33, to: 34 },
  { id: 44, from: 73, to: 61 },
  { id: 45, from: 5, to: 6 },
  { id: 46, from: 6, to: 7 },
  { id: 47, from: 7, to: 8 },
  { id: 48, from: 9, to: 58 },
  { id: 49, from: 5, to: 4 },
  { id: 50, from: 13, to: 12 },
  { id: 51, from: 12, to: 11 },
  { id: 52, from: 11, to: 10 },
  { id: 53, from: 53, to: 52 },
  { id: 54, from: 51, to: 50 },
  { id: 55, from: 49, to: 48 },
  { id: 56, from: 15, to: 14 },
  { id: 57, from: 67, to: 33 },
  { id: 58, from: 37, to: 39 },
  { id: 59, from: 70, to: 20 },
  { id: 60, from: 20, to: 21 },
  { id: 61, from: 21, to: 22 },
  { id: 62, from: 23, to: 24 },
  { id: 63, from: 24, to: 25 },
  { id: 64, from: 25, to: 26 },
  { id: 65, from: 79, to: 1 },
  { id: 66, from: 79, to: 2 },
  { id: 67, from: 73, to: 80 },
  { id: 68, from: 80, to: 2 },
  { id: 69, from: 3, to: 81 },
  { id: 70, from: 81, to: 64 },
  { id: 71, from: 81, to: 82 },
  { id: 72, from: 83, to: 66 },
  { id: 73, from: 6, to: 83 },
  { id: 74, from: 4, to: 58 },
  { id: 75, from: 4, to: 66 },
  { id: 76, from: 58, to: 66 },
  { id: 77, from: 13, to: 67 },
  { id: 78, from: 12, to: 67 },
  { id: 79, from: 11, to: 67 },
  { id: 80, from: 7, to: 83 },
  { id: 81, from: 8, to: 83 },
  { id: 82, from: 10, to: 33 },
  { id: 83, from: 67, to: 10 },
  { id: 84, from: 66, to: 9 },
  { id: 85, from: 5, to: 83 },
  { id: 86, from: 84, to: 72 },
  { id: 87, from: 9, to: 84 },
  { id: 88, from: 84, to: 33 },
  { id: 89, from: 37, to: 17 },
  { id: 90, from: 22, to: 43 },
  { id: 91, from: 43, to: 70 },
  { id: 92, from: 26, to: 45 },
  { id: 93, from: 45, to: 25 },
  { id: 94, from: 24, to: 45 },
  { id: 95, from: 23, to: 45 },
  { id: 96, from: 37, to: 16 },
  { id: 97, from: 37, to: 18 },
  { id: 98, from: 37, to: 19 },
  { id: 99, from: 45, to: 43 },
  { id: 100, from: 41, to: 37 },
  { id: 101, from: 41, to: 70 },
  { id: 102, from: 21, to: 43 },
  { id: 103, from: 43, to: 20 },
  { id: 104, from: 22, to: 41 },
  { id: 105, from: 41, to: 21 },
  { id: 106, from: 20, to: 41 },
  { id: 107, from: 85, to: 22 },
  { id: 108, from: 85, to: 45 },
  { id: 109, from: 23, to: 85 },
  { id: 110, from: 85, to: 43 },
  { id: 111, from: 86, to: 37 },
  { id: 112, from: 70, to: 86 },
  { id: 113, from: 86, to: 19 },
  { id: 114, from: 86, to: 41 },
  { id: 115, from: 8, to: 87 },
  { id: 116, from: 87, to: 47 },
  { id: 117, from: 16, to: 69 },
  { id: 118, from: 39, to: 69 },
  { id: 119, from: 69, to: 88 },
  { id: 120, from: 89, to: 68 },
  { id: 121, from: 90, to: 91 },
  { id: 122, from: 91, to: 92 },
  { id: 123, from: 92, to: 93 },
  { id: 124, from: 93, to: 94 },
  { id: 125, from: 92, to: 95 },
  { id: 126, from: 95, to: 96 },
  { id: 127, from: 96, to: 97 },
  { id: 128, from: 97, to: 98 },
  { id: 129, from: 99, to: 100 },
  { id: 130, from: 100, to: 101 },
  { id: 131, from: 101, to: 102 },
  { id: 132, from: 102, to: 103 },
  { id: 133, from: 103, to: 104 },
  { id: 134, from: 90, to: 105 },
  { id: 135, from: 105, to: 106 },
  { id: 136, from: 106, to: 107 },
  { id: 137, from: 107, to: 94 },
  { id: 138, from: 13, to: 89 },
]

// 플레이백 로봇(0~2)의 초기 위치는 각 경로의 시작 노드와 일치시킴
// node.x → robot.x (3D X),  node.y → robot.z (3D Z)
export const sampleRobots: Robot[] = [
  // ── 플레이백 로봇 3대 (mapStore.robots[0~2]) ─────────────────────────
  { id: 1, type: 'Box',      x:  2.190, y: 0.4, z:  6.350,  status: 'normal', workProgress:  0, blink: false, errorMarker: false, shadowDisc: false },
  { id: 2, type: 'Cylinder', x:  7.150, y: 0.4, z:  6.350,  status: 'normal', workProgress:  0, blink: false, errorMarker: false, shadowDisc: false },
  { id: 3, type: 'Box',      x: -13.449, y: 0.4, z: 10.793, status: 'normal', workProgress:  0, blink: false, errorMarker: false, shadowDisc: false },
  // ── 정적 로봇 2대 (mapStore.robots[3~4]) ─────────────────────────────
  { id: 4, type: 'Cylinder', x: 19.764, y: 0.4, z: 10.400,  status: 'warning', workProgress: 60, blink: false, errorMarker: false, shadowDisc: false },
  { id: 5, type: 'Box',      x: -17.449, y: 0.4, z:  3.437, status: 'normal',  workProgress: 30, blink: false, errorMarker: false, shadowDisc: false },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

export function statusToNumber(status: RobotStatus): number {
  return status === 'normal' ? 0 : status === 'warning' ? 1 : 2
}
