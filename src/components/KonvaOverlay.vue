<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { worldToScreen } from '../utils/coordinateSync'
import { sampleTasks } from '../data/sampleTasks'

const appStore    = useAppStore()
const mapStore    = useMapStore()
const playback    = usePlaybackStore()

const selectedNodeId = ref<number | null>(null)

const editScale = 40

// 고유값 분해로 구한 정확한 타원 주축 파라미터
// 편집 모드: 탑뷰 고정이므로 X=Y, rotation=0
const ellipseRX = computed(() =>
  appStore.mode === 'editing' ? editScale : appStore.mapEllipseRadiusX,
)
const ellipseRY = computed(() =>
  appStore.mode === 'editing' ? editScale : appStore.mapEllipseRadiusY,
)
const ellipseRot = computed(() =>
  appStore.mode === 'editing' ? 0 : appStore.mapEllipseRotation,
)
// 폰트·선 두께 등 단일 zoom 지표가 필요한 곳
const nodeScale = computed(() =>
  appStore.mode === 'editing' ? editScale : appStore.mapScale,
)

const editOffset = computed(() => ({
  x: appStore.containerWidth / 2,
  y: appStore.containerHeight / 2,
}))

function toScreenX(worldX: number): number {
  if (appStore.mode === 'monitoring') return 0
  return worldX * editScale + editOffset.value.x
}

function toScreenY(worldY: number): number {
  if (appStore.mode === 'monitoring') return 0
  return worldY * editScale + editOffset.value.y
}

function nodeScreenPos(nodeId: number) {
  if (appStore.mode === 'monitoring') {
    const p = mapStore.projectedNodes.get(nodeId)
    return p ?? { x: 0, y: 0 }
  }
  const node = mapStore.getNode(nodeId)
  if (!node) return { x: 0, y: 0 }
  return { x: toScreenX(node.x), y: toScreenY(node.y) }
}

// ─── zone area fills (ellipses behind zone hub nodes) ────────────────────────

const zoneAreaConfigs = computed(() => {
  void mapStore.projectedVersion
  return mapStore.nodes
    .filter((n) => !!n.label)
    .map((n) => {
      const pos = nodeScreenPos(n.id)
      return {
        id:          n.id,
        x:           pos.x,
        y:           pos.y,
        radiusX:     ellipseRX.value * 0.7,
        radiusY:     ellipseRY.value * 0.7,
        rotation:    ellipseRot.value,
        fill:        'rgba(8, 24, 62, 0.2)',
        strokeWidth: 1,
        listening:   false,
      }
    })
})

// ─── links (road surface + dashed centre lane) ────────────────────────────────

const linkConfigs = computed(() => {
  void mapStore.projectedVersion
  const s = nodeScale.value
  return mapStore.links.map((link) => {
    const from = nodeScreenPos(link.from)
    const to   = nodeScreenPos(link.to)

    if (from.x === -9999 || to.x === -9999) {
      return null
    }

    const pts  = [from.x, from.y, to.x, to.y]
    const roadW = Math.max(2, s * 0.22)
   // const dashLen = Math.max(4, s * 0.22)
   // const gapLen  = Math.max(3, s * 0.18)
    return {
      id:   link.id,
      road: {
        points:      pts,
        stroke:      '#3d3d3d',
        strokeWidth: roadW,
        lineCap:     'round',
        lineJoin:    'round',
        listening:   false,
      },
      lane: {
        points:      pts,
        stroke:      '#5d5d5d',
        strokeWidth: 1,
       // dash:        [dashLen, gapLen],
        lineCap:     'round',
        listening:   false,
      },
    }
  }).filter(config => config !== null)
})

// ─── nodes ────────────────────────────────────────────────────────────────────

const nodeConfigs = computed(() => {
  void mapStore.projectedVersion
  void playback.currentIndex
  const futureIds = selectedFutureNodeIds.value
  return mapStore.nodes.map((node) => {
    const pos      = nodeScreenPos(node.id)
    const isZone   = !!node.label
    const isEdit   = appStore.mode === 'editing'
    //const isSel    = selectedNodeId.value === node.id
    const isFuture = futureIds.has(node.id)
    const rx = ellipseRX.value
    const ry = ellipseRY.value
    return {
      id:          node.id,
      x:           pos.x,
      y:           pos.y,
      radiusX:     isZone ? Math.max(2, rx * 0.15) : Math.max(1, rx * 0.09),
      radiusY:     isZone ? Math.max(2, ry * 0.15) : Math.max(1, ry * 0.09),
      rotation:    ellipseRot.value,
      fill:        '#9e9e9e',//isSel ? '#ffd43b' : isZone ? 'rgba(93, 146, 212, 0.5)' : '#0a2444',
      stroke:      isFuture ? '#c177e6' : '#696969',//isZone ? '#447a99' : '#133857',
      strokeWidth: 4,
      draggable:   isEdit,
      label:       node.label ?? '',
    }
  })
})

const stageConfig = computed(() => ({
  width:  appStore.containerWidth,
  height: appStore.containerHeight,
}))

// ─── arrow animation ──────────────────────────────────────────────────────────

const arrowProgress = ref(0)
const tailOpacity = ref(1)
let animFrameId = 0

onMounted(() => {
  function loop() {
    arrowProgress.value = (arrowProgress.value + 0.003) % 1

    // 💡 꼬리 깜빡임 업데이트 (Math.sin을 이용해 0.2 ~ 1.0 사이를 부드럽게 오감)
    // Date.now() 나누기 값을 조절하면 깜빡이는 속도를 바꿀 수 있어. (숫자가 작을수록 빠름)
    tailOpacity.value = 0.6 + 0.4 * Math.sin(Date.now() / 200)


    animFrameId = requestAnimationFrame(loop)
  }
  animFrameId = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
})

// ─── polyline helpers ─────────────────────────────────────────────────────────

function polylineLength(pts: number[]): number {
  let len = 0
  const n = Math.floor(pts.length / 2)
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[(i + 1) * 2]     - pts[i * 2]
    const dy = pts[(i + 1) * 2 + 1] - pts[i * 2 + 1]
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

function interpolatePolyline(
  pts: number[],
  t: number,
): { x: number; y: number; angle: number } | null {
  const n = Math.floor(pts.length / 2)
  if (n < 2) return null
  const totalLen = polylineLength(pts)
  if (totalLen === 0) return null
  const targetLen = totalLen * Math.max(0, Math.min(1, t))
  let accumulated = 0
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[i * 2],     y0 = pts[i * 2 + 1]
    const x1 = pts[(i+1) * 2], y1 = pts[(i+1) * 2 + 1]
    const dx = x1 - x0, dy = y1 - y0
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (accumulated + segLen >= targetLen) {
      const frac = segLen > 0 ? (targetLen - accumulated) / segLen : 0
      return {
        x:     x0 + dx * frac,
        y:     y0 + dy * frac,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      }
    }
    accumulated += segLen
  }
  const last = n - 1
  const dx = pts[last * 2] - pts[(last - 1) * 2]
  const dy = pts[last * 2 + 1] - pts[(last - 1) * 2 + 1]
  return {
    x:     pts[last * 2],
    y:     pts[last * 2 + 1],
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

// ─── which playback robot is selected (0, 1, 2, or -1) ───────────────────────



// ─── selected robot: full trajectory ─────────────────────────────────────────

const selectedTrajectoryPoints = computed<number[]>(() => {
  void mapStore.projectedVersion

  const selectedIdx = appStore.selectedRobotId
  if (selectedIdx === null || !appStore.threeCamera) return []

  // 인덱스 밀림 방지: ID 매칭이 안전하지만,
  // 구조상 histories[selectedIdx]를 쓰신다면 아래와 같이 behindCamera 체크만 강화합니다.
  const history = playback.histories[selectedIdx] || []
  const pts: number[] = []

  history.forEach((p) => {
    const s = worldToScreen(p.x, p.y, appStore.threeCamera!, appStore.containerWidth, appStore.containerHeight)
    if (!s.behindCamera) { // 이제 behindCamera를 사용할 수 있습니다!
      pts.push(s.x, s.y)
    }
  })
  return pts
})

// ─── selected robot: future path ─────────────────────────────────────────────

const selectedFutureNodeIds = computed<Set<number>>(() => {
  const selectedIdx = appStore.selectedRobotId
  if (selectedIdx === null) return new Set()
  void playback.currentIndex
  if (appStore.mode !== 'monitoring') return new Set()
  const frame = playback.currentFrames[selectedIdx]
  if (!frame) return new Set()
  return new Set(frame.path.slice(frame.pathIndex + 1).map(Number))
})

const selectedFuturePoints = computed<number[]>(() => {
  const selectedIdx = appStore.selectedRobotId
  if (selectedIdx === null || !appStore.threeCamera) return []
  void mapStore.projectedVersion
  void playback.currentIndex
  if (appStore.mode !== 'monitoring') return []

  const cam = appStore.threeCamera
  if (!cam) return []
  const frame = playback.currentFrames[selectedIdx]
  if (!frame) return []
  const w = appStore.containerWidth, h = appStore.containerHeight

  const cur = worldToScreen(frame.x, frame.y, cam, w, h) // 로봇의 현재 위치
  const pts: number[] = [cur.x, cur.y]
  const futureIds = frame.path.slice(frame.pathIndex + 1)
  for (const nid of futureIds) {
    const pt = mapStore.projectedNodes.get(Number(nid))
    if (pt) pts.push(pt.x, pt.y)
  }
  return pts
})

// ─── moving arrows along future path ─────────────────────────────────────────
const ARROW_SPACING = 40  // px, 화살표 사이의 절대 픽셀 간격
const ARROW_HALF  = 1     // px, 화살표 반길이
const SPEED_FACTOR = 5    // 이동 속도 조절 (숫자 가 클수록 빠름)

const movingArrows = computed(() => {
  const pts = selectedFuturePoints.value
  if (pts.length < 4) return []

  const totalLen = polylineLength(pts)
  if (totalLen === 0) return []

  // 1. 순환 오프셋 계산 (가장 핵심적인 변경 사항 🌟)
  // arrowProgress(0~1)를 사용하여 0px ~ ARROW_SPACING(40px) 사이를 무한히 반복하는 시작점을 만듭니다.
  // 이렇게 하면 40px 이동 후 다시 0px로 돌아가며 화살표들이 한 칸씩 교대되어 완벽히 부드럽게 이어집니다.
  const baseOffset = (arrowProgress.value * SPEED_FACTOR * ARROW_SPACING) % ARROW_SPACING

  const arrows: { points: number[] }[] = []

  // 2. 전체 비율을 나누는 것이 아니라, 픽셀 거리(d)를 직접 증가시키며 화살표를 렌더링합니다.
  for (let d = baseOffset; d <= totalLen; d += ARROW_SPACING) {
    // 거리가 경로 길이를 초과하지 않을 때만 그립니다.
    // 기존 interpolatePolyline 함수가 t(0~1) 값을 받으므로, 절대 거리를 비율로 다시 변환해 줍니다.
    const t = d / totalLen
    const pos = interpolatePolyline(pts, t)

    if (!pos) continue

    const rad = (pos.angle * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    arrows.push({
      points: [
        pos.x - cos * ARROW_HALF, pos.y - sin * ARROW_HALF,
        pos.x + cos * ARROW_HALF, pos.y + sin * ARROW_HALF,
      ],
    })
  }

  return arrows
})

// ─── non-selected robots: gradient tail ──────────────────────────────────────


// ─── task 2D start/end markers ────────────────────────────────────────────────

const task2DMarkers = computed(() => {
  if (mapStore.taskTooltipMode !== '2d') return null
  const taskId = appStore.selectedTaskId
  if (!taskId) return null
  void mapStore.projectedVersion

  const task = sampleTasks.find(t => t.id === taskId)
  if (!task || task.pathList.length < 1) return null

  const firstItem = task.pathList[0]
  const lastItem  = task.pathList[task.pathList.length - 1]

  const startPt = mapStore.projectedNodes.get(Number(firstItem.node))
  const endPt   = mapStore.projectedNodes.get(Number(lastItem.node))

  const start = startPt && startPt.x !== -9999 ? { x: startPt.x, y: startPt.y } : null
  const end   = endPt   && endPt.x   !== -9999 ? { x: endPt.x,   y: endPt.y   } : null
  if (!start && !end) return null
  return { start, end }
})

// SVG path for a map pin shape: tip at (0,0), circle head above
const PIN_PATH = 'M 0 0 C -6 -3 -13 -9 -13 -18 A 13 13 0 0 1 13 -18 C 13 -9 6 -3 0 0 Z'

// ─── selected task: full path ─────────────────────────────────────────────────

const taskFullPathPoints = computed<number[]>(() => {
  const taskId = appStore.selectedTaskId
  if (!taskId) return []
  void mapStore.projectedVersion

  const task = sampleTasks.find((t) => t.id === taskId)
  if (!task) return []

  const pts: number[] = []
  for (const item of task.pathList) {
    const pt = mapStore.projectedNodes.get(Number(item.node))
    if (pt) pts.push(pt.x, pt.y)
  }
  return pts
})

// 태스크 경로선 설정 — 2D: 보라색 단색 / 3D: 파란→빨간 그라데이션
const taskPathLineConfig = computed(() => {
  const pts = taskFullPathPoints.value
  if (pts.length < 4) return null

  if (mapStore.taskTooltipMode === '3d') {
    const startX = pts[0],             startY = pts[1]
    const endX   = pts[pts.length - 2], endY  = pts[pts.length - 1]
    return {
      points:      pts,
      strokeWidth: 10,
      lineCap:     'round',
      lineJoin:    'round',
      listening:   false,
      opacity:     0.55,
      strokeLinearGradientStartPoint: { x: startX, y: startY },
      strokeLinearGradientEndPoint:   { x: endX,   y: endY   },
      strokeLinearGradientColorStops: [0, '#2563eb', 1, '#ef4444'],
    }
  }
  // 2D mode: solid purple
  return {
    points:      pts,
    stroke:      'rgb(176, 39, 245)',
    strokeWidth: 10,
    lineCap:     'round',
    lineJoin:    'round',
    listening:   false,
    opacity:     0.3,
  }
})

const taskMovingArrows = computed(() => {
  const pts = taskFullPathPoints.value
  if (pts.length < 4) return []

  const totalLen = polylineLength(pts)
  if (totalLen === 0) return []

  const baseOffset = (arrowProgress.value * SPEED_FACTOR * ARROW_SPACING) % ARROW_SPACING
  const arrows: { points: number[] }[] = []

  for (let d = baseOffset; d <= totalLen; d += ARROW_SPACING) {
    const t = d / totalLen
    const pos = interpolatePolyline(pts, t)
    if (!pos) continue

    const rad = (pos.angle * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    arrows.push({
      points: [
        pos.x - cos * ARROW_HALF, pos.y - sin * ARROW_HALF,
        pos.x + cos * ARROW_HALF, pos.y + sin * ARROW_HALF,
      ],
    })
  }

  return arrows
})

// ─── node interactions ────────────────────────────────────────────────────────

function onNodeClick(nodeId: number) {
  if (appStore.mode !== 'editing') return
  selectedNodeId.value = selectedNodeId.value === nodeId ? null : nodeId
}

function onNodeDragEnd(nodeId: number, e: any) {
  if (appStore.mode !== 'editing') return
  const node = mapStore.getNode(nodeId)
  if (!node) return
  node.x = (e.target.x() - editOffset.value.x) / editScale
  node.y = (e.target.y() - editOffset.value.y) / editScale
}
const TAIL_LEN = 15; //

const allRobotTails = computed(() => {
  void mapStore.projectedVersion // 카메라 이동 시 재계산 강제
  const cam = appStore.threeCamera
  if (!cam) return []

  const w = appStore.containerWidth
  const h = appStore.containerHeight
  const tails: any[] = []

  // 모든 로봇의 이력(history)을 순회합니다.
  playback.histories.forEach((history, idx) => {
    const robot = mapStore.robots[idx]
    if (!robot || history.length < 2) return

    // 💡 핵심 1: 전체 history가 아니라 최신 기록 TAIL_LEN 개수만 잘라냅니다.
    const tailLen = Math.min(TAIL_LEN, history.length)
    const recentHistory = history.slice(-tailLen)

    // 1. 3D 좌표를 2D 화면 좌표로 투영 (잘라낸 최근 기록만 투영)
    const pts: number[] = []
    recentHistory.forEach((p) => {
      const s = worldToScreen(p.x, p.y, cam, w, h)
      if (!s.behindCamera) pts.push(s.x, s.y)
    })

    if (pts.length < 4) return // 선을 그리려면 최소 2개의 점(x,y 4개) 필요

    // 2. 그라데이션 방향 설정 (꼬리 끝점 -> 로봇 현재 머리 위치)
    const startX = pts[0]
    const startY = pts[1]
    const endX = pts[pts.length - 2]
    const endY = pts[pts.length - 1]

    const color = '176, 39, 245'
    const alpha = 0.8
    const weight = 9

    tails.push({
      id: robot.id,
      points: pts,
      strokeWidth: weight,
      startX,
      startY,
      endX,
      endY,
      // 💡 핵심 2: 시작점(0)은 투명하게, 끝점(1)은 불투명하게 그라데이션 적용
      colorStops: [
        0, `rgba(${color}, 0)`,
        1, `rgba(${color}, ${alpha})`
      ]
    })
  })

  return tails
})

// 새로 추가할 말풍선(툴팁) 모양의 SVG Path
// 1. M 0 0: 뾰족한 끝점 (실제 마커가 가리키는 좌표)
// 2. L 5 -7: 오른쪽 위로 짧은 선을 그어 삼각형의 오른쪽 면을 만듦
// 3. A 14 14 0 1 0 -5 -7: 반지름 14인 둥근 원형(말풍선 머리 부분)을 그림
// 4. Z: 다시 원점으로 선을 이어 삼각형의 왼쪽 면을 닫음
const BUBBLE_PATH = 'M 0 0 L 5 -7 A 14 14 0 1 0 -5 -7 Z';

</script>

<template>
  <div
    class="konva-overlay"
    :style="{ pointerEvents: appStore.mode === 'monitoring' ? 'none' : 'auto' }"
  >
    <v-stage :config="stageConfig">

      <!-- ── Layer 1: background plane + zone fills ──────────────────────── -->
      <v-layer>
        <v-ellipse
          v-for="zone in zoneAreaConfigs"
          :key="'zf-' + zone.id"
          :config="{
            x: zone.x, y: zone.y,
            radiusX: zone.radiusX,
            radiusY: zone.radiusY,
            rotation: zone.rotation,
            fill: zone.fill,
            strokeWidth: zone.strokeWidth,
            listening: zone.listening,
          }"
        />
      </v-layer>

      <!-- ── Layer 2: roads + nodes + labels ────────────────────────────── -->
      <v-layer>
        <!-- Road surface (thick dark) -->
        <v-line
          v-for="link in linkConfigs"
          :key="'road-' + link.id"
          :config="link.road"
        />
        <!-- Road centre lane (dashed) -->
        <v-line
          v-for="link in linkConfigs"
          :key="'lane-' + link.id"
          :config="link.lane"
        />
        <!-- Nodes -->
        <v-ellipse
          v-for="node in nodeConfigs"
          :key="node.id"
          :config="{
            x: node.x, y: node.y,
            radiusX: node.radiusX,
            radiusY: node.radiusY,
            rotation: node.rotation,
            fill: node.fill,
            stroke: node.stroke,
            strokeWidth: node.strokeWidth,
            draggable: node.draggable,
          }"
          @click="onNodeClick(node.id)"
          @dragend="onNodeDragEnd(node.id, $event)"
        />
        <!-- Zone labels only -->
        <v-text
          v-for="node in nodeConfigs.filter(n => n.label)"
          :key="'lbl-' + node.id"
          :config="{
            x: node.x - 20,
            y: node.y + node.radiusY + 2,
            width: 40,
            text: node.label,
            fontSize: Math.max(7, Math.min(14, nodeScale * 0.30)),
            align: 'center',
            fill: '#696969',
            listening: false,
          }"
        />
      </v-layer>

      <!-- ── Layer 3: playback trajectories ────────────────────────────── -->
      <v-layer>

        <!-- 선택 로봇: 전체 궤적 (실선) -->
        <v-line
          v-if="selectedTrajectoryPoints.length >= 4"
          :config="{
            points:      selectedTrajectoryPoints,
            stroke:      'rgb(153, 148, 156)',
            strokeWidth: 9,
            lineCap:     'round',
            lineJoin:    'round',
            listening:   false,
            opacity:     0.5,
          }"
        />

        <!-- 선택 로봇: 과거 궤적 (안쪽 링크) -->
        <v-line
            v-if="selectedTrajectoryPoints.length >= 4"
            :config="{
    points:      selectedTrajectoryPoints,
    stroke:      '#908e91',
    strokeWidth: 2,
    dash:        [12, 12],
    // 💡 dashOffset을 추가하여 애니메이션 효과를 줍니다.
    // dash 배열의 합(12+12=24)을 곱해주면 흐름이 끊기지 않고 부드럽게 이어집니다.
    // 마이너스(-)를 붙이면 로봇이 진행하는 방향으로 흐르는 느낌을 줍니다.
    dashOffset:  -arrowProgress * 24 * 5,
    lineCap:     'round',
    lineJoin:    'round',
    listening:   false,
    opacity: tailOpacity,
  }"
        />

        <v-line
            v-for="tail in allRobotTails"
            :key="'tail-' + tail.id"
            :config="{
              points: tail.points,
              strokeWidth: tail.strokeWidth,
              lineCap: 'round',
              lineJoin: 'round',
              listening: false,
              // 💡핵심: fill이 아니라 stroke 그라데이션 속성을 사용!
              strokeLinearGradientStartPoint: { x: tail.startX, y: tail.startY },
              strokeLinearGradientEndPoint: { x: tail.endX, y: tail.endY },
              strokeLinearGradientColorStops: tail.colorStops
            }" />


        <!-- 선택 로봇: 앞으로 갈 경로 -->
        <v-line
          v-if="selectedFuturePoints.length >= 4"
          :config="{
            points:      selectedFuturePoints,
            stroke:      'rgb(176, 39, 245)',
            strokeWidth: 10,
            //dash:        [6, 5],
            lineCap:     'round',
            lineJoin:    'round',
            listening:   false,
            opacity:     0.3,
          }"
        />

        <!-- 선택 로봇: 이동 화살표 (future path 위에서 움직임) -->
        <v-arrow
          v-for="(arrow, ai) in movingArrows"
          :key="'arrow-' + ai"
          :config="{
            points:        arrow.points,
            fill:          '#908e91',
            dash:        [6, 5],
            //stroke:        '#ffd43b',
            //strokeWidth:   2,
            pointerLength: 7,
            pointerWidth:  9,
            listening:     false,
            opacity: tailOpacity,
          }"
        />

        <!-- 선택 태스크: 전체 경로 (2D: 보라색 / 3D: 파란→빨간 그라데이션) -->
        <v-line
          v-if="taskPathLineConfig"
          :config="taskPathLineConfig"
        />

        <!-- 선택 태스크: 이동 화살표 -->
        <v-arrow
          v-for="(arrow, ai) in taskMovingArrows"
          :key="'task-arrow-' + ai"
          :config="{
            points:        arrow.points,
            fill:          '#c177e6',
            pointerLength: 7,
            pointerWidth:  9,
            listening:     false,
            opacity:       tailOpacity,
          }"
        />

        <!-- 태스크 2D 마커: 출발 -->
        <v-group
            v-if="task2DMarkers?.start"
            :config="{ x: task2DMarkers.start.x, y: task2DMarkers.start.y, listening: false }"
        >
          <v-path :config="{
      data:        BUBBLE_PATH,  fill:        '#0d0d1e',
      stroke:      '#7b2fff',    strokeWidth: 1.5,
      listening:   false,
    }" />
          <v-text :config="{
      x: -4, y: -25,             text:      '▶',
      fontSize:  11,
      fill:      '#c77dff',
      listening: false,
    }" />
          <v-text :config="{
      x: 18, y: -26,             text:      '출발',
      fontSize:  12,
      fill:      '#ffffff',      fontStyle: 'bold',
      listening: false,
    }" />
        </v-group>

        <v-group
            v-if="task2DMarkers?.end"
            :config="{ x: task2DMarkers.end.x, y: task2DMarkers.end.y, listening: false }"
        >
          <v-path :config="{
      data:        BUBBLE_PATH,
      fill:        '#0d0d1e',
      stroke:      '#7b2fff',
      strokeWidth: 1.5,
      listening:   false,
    }" />
          <v-text :config="{
      x: -6, y: -26,
      text:      '⚑',
      fontSize:  13,
      fill:      '#c77dff',
      listening: false,
    }" />
          <v-text :config="{
      x: 18, y: -26,
      text:      '도착',
      fontSize:  12,
      fill:      '#ffffff',
      fontStyle: 'bold',
      listening: false,
    }" />
        </v-group>


      </v-layer>

    </v-stage>
  </div>
</template>

<style scoped>
.konva-overlay {
  position: absolute;
  inset: 0;
}
</style>
