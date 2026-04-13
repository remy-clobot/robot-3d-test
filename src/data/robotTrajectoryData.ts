// ─── Robot Trajectory Sample Data ─────────────────────────────────────────────
//
// 3대 로봇의 이동 기록 각 200 프레임 (WebSocket 수신 시뮬레이션)
//
// 필드 설명
//   x, y       현재 위치 (맵 좌표계 m,  node.x/node.y와 동일 체계)
//   angle      진행 방향 (도, 0=동/+x  90=북/+y  180=서  270=남)
//   pathIndex  path[] 에서 마지막으로 통과한 노드의 인덱스 (0-based)
//   path       FMS 계획 경로 노드 ID 배열 (전 프레임 동일)

export interface RobotFrame {
  x:         number
  y:         number
  angle:     number
  pathIndex: number
  path:      string[]
}

type PathNode = Readonly<{ id: string; x: number; y: number }>

function calcAngle(from: PathNode, to: PathNode): number {
  return Math.round(
    (((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI) % 360 + 360) % 360,
  )
}

function generateFrames(
  pathNodes: readonly PathNode[],
  framesPerSegment: readonly number[],
): RobotFrame[] {
  const path: string[] = pathNodes.map((n) => n.id)
  const frames: RobotFrame[] = []

  for (let seg = 0; seg < pathNodes.length - 1; seg++) {
    const from  = pathNodes[seg]
    const to    = pathNodes[seg + 1]
    const count = framesPerSegment[seg]
    const dx    = to.x - from.x
    const dy    = to.y - from.y
    const angle = calcAngle(from, to)

    for (let f = 0; f < count; f++) {
      const t = f / count
      frames.push({
        x:         +((from.x + dx * t).toFixed(3)),
        y:         +((from.y + dy * t).toFixed(3)),
        angle,
        pathIndex: seg,
        path,
      })
    }
  }

  // 최종 도착 프레임
  const dest = pathNodes[pathNodes.length - 1]
  frames.push({
    x: dest.x, y: dest.y, angle: 90,
    pathIndex: pathNodes.length - 1, path,
  })

  return frames
}

// ─── Robot 1: 8→87→47→45→43→41→70→86→19→18→17→16→69→88 ──────────────────────
//
//   링크 검증: 8→87(L115) 87→47(L116) 47→45(L36) 45→43(L99) 43→41(L35)
//             41→70(L101) 70→86(L112) 86→19(L113) 19→18(L32) 18→17(L33)
//             17→16(L34) 16→69(L117) 69→88(L119)

const R1_PATH = [
  { id: '8',  x:  2.190, y:  6.350 },
  { id: '87', x: -0.500, y:  3.237 },
  { id: '47', x:  2.490, y: -0.976 },
  { id: '45', x:  4.497, y: -0.976 },
  { id: '43', x: 11.441, y: -0.976 },
  { id: '41', x: 13.438, y: -0.976 },
  { id: '70', x: 14.650, y:  0.770 },
  { id: '86', x: 15.830, y: -0.176 },
  { id: '19', x: 16.960, y:  0.400 },
  { id: '18', x: 18.590, y:  0.400 },
  { id: '17', x: 20.220, y:  0.400 },
  { id: '16', x: 21.894, y:  0.400 },
  { id: '69', x: 23.700, y:  1.500 },
  { id: '88', x: 23.700, y:  2.500 },
] as const

// 13 세그먼트, 합계 199 + 최종 1 = 200
const R1_FRAMES_PER_SEG = [25, 31, 12, 40, 12, 13, 9, 8, 10, 10, 10, 13, 6] as const

// ─── Robot 2: 5→6→7→8→83→66→9→84→33 ─────────────────────────────────────────
//
//   링크 검증: 5→6(L45) 6→7(L46) 7→8(L47) 8→83(L81) 83→66(L72)
//             66→9(L84) 9→84(L87) 84→33(L88)

const R2_PATH = [
  { id: '5',  x:  7.150, y:  6.350 },
  { id: '6',  x:  5.510, y:  6.350 },
  { id: '7',  x:  3.850, y:  6.350 },
  { id: '8',  x:  2.190, y:  6.350 },
  { id: '83', x:  8.063, y:  7.967 },
  { id: '66', x: 10.269, y: 10.400 },
  { id: '9',  x: 12.865, y:  6.280 },
  { id: '84', x: 14.650, y:  6.350 },
  { id: '33', x: 15.290, y:  7.967 },
] as const

// 8 세그먼트, 합계 199 + 최종 1 = 200
const R2_FRAMES_PER_SEG = [14, 15, 15, 53, 29, 43, 16, 14] as const

// ─── Robot 3: 99→100→101→102→103→104 ─────────────────────────────────────────
//
//   링크 검증: 99→100(L129) 100→101(L130) 101→102(L131)
//             102→103(L132) 103→104(L133)

const R3_PATH = [
  { id: '99',  x: -13.449, y: 10.793 },
  { id: '100', x:  -7.812, y: 10.740 },
  { id: '101', x:  -7.785, y:  8.905 },
  { id: '102', x: -13.503, y:  9.040 },
  { id: '103', x: -19.276, y:  9.121 },
  { id: '104', x: -19.357, y: 10.766 },
] as const

// 5 세그먼트, 합계 199 + 최종 1 = 200
const R3_FRAMES_PER_SEG = [54, 18, 55, 56, 16] as const

// ─── exports ──────────────────────────────────────────────────────────────────

export const robot1Frames: RobotFrame[] = generateFrames(R1_PATH, R1_FRAMES_PER_SEG)
export const robot2Frames: RobotFrame[] = generateFrames(R2_PATH, R2_FRAMES_PER_SEG)
export const robot3Frames: RobotFrame[] = generateFrames(R3_PATH, R3_FRAMES_PER_SEG)

/** 전체 로봇 프레임 배열 (인덱스 0~2 = 로봇 1~3) */
export const ALL_ROBOT_FRAMES: RobotFrame[][] = [robot1Frames, robot2Frames, robot3Frames]

/** @deprecated robot1Frames 를 사용하세요 */
export const robotFrames = robot1Frames
