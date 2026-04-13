<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { worldToScreen } from '../utils/coordinateSync'

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
    const dashLen = Math.max(4, s * 0.22)
    const gapLen  = Math.max(3, s * 0.18)
    return {
      id:   link.id,
      road: {
        points:      pts,
        stroke:      '#0b1e3e',
        strokeWidth: roadW,
        lineCap:     'round',
        lineJoin:    'round',
        listening:   false,
      },
      lane: {
        points:      pts,
        stroke:      '#1e4e82',
        strokeWidth: Math.max(1, roadW * 0.2),
        dash:        [dashLen, gapLen],
        lineCap:     'round',
        listening:   false,
      },
    }
  }).filter(config => config !== null)
})

// ─── nodes ────────────────────────────────────────────────────────────────────

const nodeConfigs = computed(() => {
  void mapStore.projectedVersion
  return mapStore.nodes.map((node) => {
    const pos      = nodeScreenPos(node.id)
    const isZone   = !!node.label
    const isEdit   = appStore.mode === 'editing'
    const isSel    = selectedNodeId.value === node.id
    const rx = ellipseRX.value
    const ry = ellipseRY.value
    return {
      id:          node.id,
      x:           pos.x,
      y:           pos.y,
      radiusX:     isZone ? Math.max(2, rx * 0.15) : Math.max(1, rx * 0.09),
      radiusY:     isZone ? Math.max(2, ry * 0.15) : Math.max(1, ry * 0.09),
      rotation:    ellipseRot.value,
      fill:        isSel ? '#ffd43b' : isZone ? 'rgba(93, 146, 212, 0.5)' : '#0a2444',
      stroke:      isZone ? '#447a99' : '#133857',
      strokeWidth: 1,
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
let animFrameId = 0

onMounted(() => {
  function loop() {
    arrowProgress.value = (arrowProgress.value + 0.003) % 1
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

const ROBOT_COLORS = ['#4a9eff', '#4aff9e', '#ff9e4a'] as const

const selectedPlaybackIdx = computed(() => {
  const selId = appStore.selectedRobotId
  if (selId === null) return -1
  for (let i = 0; i < 3; i++) {
    const r = mapStore.robots[i]
    if (r && r.id === selId) return i
  }
  return -1
})

const selectedRobotColor = computed(() =>
  selectedPlaybackIdx.value >= 0
    ? ROBOT_COLORS[selectedPlaybackIdx.value]
    : ROBOT_COLORS[0],
)

// ─── selected robot: full trajectory ─────────────────────────────────────────

const selectedTrajectoryPoints = computed<number[]>(() => {
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

  const cur = worldToScreen(frame.x, frame.y, cam, w, h)
  const pts: number[] = [cur.x, cur.y]
  const futureIds = frame.path.slice(frame.pathIndex + 1)
  for (const nid of futureIds) {
    const pt = mapStore.projectedNodes.get(Number(nid))
    if (pt) pts.push(pt.x, pt.y)
  }
  return pts
})

// ─── moving arrows along future path ─────────────────────────────────────────

const N_ARROWS    = 10
const ARROW_HALF  = 8   // px, 화살표 반길이

const movingArrows = computed(() => {
  const pts = selectedFuturePoints.value
  if (pts.length < 4) return []
  const t0 = arrowProgress.value
  const arrows: { points: number[] }[] = []
  for (let i = 0; i < N_ARROWS; i++) {
    const t   = (t0 + i / N_ARROWS) % 1
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

const TAIL_LEN = 20   // 최대 꼬리 길이 (포인트 수)

const gradientTailConfigs = computed(() => {
  void mapStore.projectedVersion
  void playback.currentIndex
  if (appStore.mode !== 'monitoring') return []
  const cam = appStore.threeCamera
  if (!cam) return []
  const w = appStore.containerWidth, h = appStore.containerHeight
  const selIdx = selectedPlaybackIdx.value

  const result: {
    robotIdx: number
    color:    string
    lines:    { points: number[]; strokeWidth: number; opacity: number }[]
  }[] = []

  for (let i = 0; i < 3; i++) {
    if (i === selIdx) continue
    const hist    = playback.histories[i]
    const tailLen = Math.min(TAIL_LEN, hist.length)
    if (tailLen < 2) continue
    const tail = hist.slice(-tailLen)
    const pts  = tail.flatMap((pt) => {
      const s = worldToScreen(pt.x, pt.y, cam, w, h)
      return [s.x, s.y]
    })
    if (pts.length < 4) continue

    // 선택 로봇이 아니므로 꼬리를 3개 레이어로 겹쳐서 그라데이션 효과
    // (로봇 쪽=최근이 두껍고 선명, 멀어질수록 얇고 투명)
    const n2 = Math.max(2, Math.ceil(tailLen * 2 / 3))
    const n1 = Math.max(2, Math.ceil(tailLen * 1 / 3))

    result.push({
      robotIdx: i,
      color:    ROBOT_COLORS[i],
      lines: [
        { points: pts,                  strokeWidth: 4, opacity: 0.15 }, // 전체
        { points: pts.slice(-n2 * 2),   strokeWidth: 6, opacity: 0.30 }, // 후반 2/3
        { points: pts.slice(-n1 * 2),   strokeWidth: 8, opacity: 0.60 }, // 후반 1/3 (로봇 근처)
      ],
    })
  }
  return result
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
            stroke: zone.stroke,
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
            fill: '#90c4e8',
            listening: false,
          }"
        />
      </v-layer>

      <!-- ── Layer 3: playback trajectories ────────────────────────────── -->
      <v-layer>

        <!-- 비선택 로봇: 그라데이션 꼬리 (3레이어 겹치기) -->
        <template
          v-for="tail in gradientTailConfigs"
          :key="'tail-' + tail.robotIdx"
        >
          <v-line
            v-for="(line, li) in tail.lines"
            :key="li"
            :config="{
              points:      line.points,
              stroke:      tail.color,
              strokeWidth: line.strokeWidth,
              opacity:     line.opacity,
              lineCap:     'round',
              lineJoin:    'round',
              listening:   false,
            }"
          />
        </template>

        <!-- 선택 로봇: 전체 궤적 (실선) -->
        <v-line
          v-if="selectedTrajectoryPoints.length >= 4"
          :config="{
            points:      selectedTrajectoryPoints,
            stroke:      selectedRobotColor,
            strokeWidth: 2,
            lineCap:     'round',
            lineJoin:    'round',
            listening:   false,
            opacity:     0.8,
          }"
        />

        <!-- 선택 로봇: 앞으로 갈 경로 -->
        <v-line
          v-if="selectedFuturePoints.length >= 4"
          :config="{
            points:      selectedFuturePoints,
            stroke:      'rgb(176, 39, 245)',
            strokeWidth: 9,
            //dash:        [6, 5],
            lineCap:     'round',
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
            fill:          '#615c63',
            //stroke:        '#ffd43b',
            //strokeWidth:   2,
            pointerLength: 7,
            pointerWidth:  9,
            listening:     false,
          }"
        />

        <v-regular-polygon
            v-for="(arrow, i) in movingArrows"
            :key="'f-arrow-' + i"
            :config="{
              x: arrow.x,
              y: arrow.y,
              sides: 3,               // 삼각형
              radius: 5,              // 크기
              fill: '#FFFFFF',        // 보라색 대비 흰색
              rotation: arrow.rotation, // 진행 방향 각도
              listening: false,
            }"
        />

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
