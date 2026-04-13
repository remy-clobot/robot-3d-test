<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'
import type { Robot } from '../data/sampleData'

const appStore = useAppStore()
const mapStore = useMapStore()

const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null

// ─── visual constants ─────────────────────────────────────────────────────────

const FONT        = '14px/1 system-ui, sans-serif'
const FONT_SMALL  = '12px/1 system-ui, sans-serif'
const FONT_TITLE  = '600 14px/1 system-ui, sans-serif'

// label pill
const PILL_H    = 22
const PADDING_X = 8

// tooltip box
const TOOLTIP_W       = 224
const TOOLTIP_PAD     = 12
const ROW_H           = 22
const TITLE_H         = 36    // 툴팁_1 타이틀 행 높이
const BOX_OFFSET_Y    = 155   // 로봇 위쪽 거리

// animation
const ANIM_ENTER_MS = 380
const ANIM_EXIT_MS  = 200

const STATUS_LABEL: Record<string, string> = {
  normal:  '정상',
  warning: '경고',
  error:   '오류',
}
const STATUS_COLORS: Record<string, string> = {
  normal:  '#2ecc71',
  warning: '#f39c12',
  error:   '#e74c3c',
}
const EFFECTS = [
  { key: 'blink'       as const, label: 'Blink'        },
  { key: 'errorMarker' as const, label: 'Error Marker'  },
  { key: 'shadowDisc'  as const, label: 'Shadow Disc'   },
]

// ─── animation state ──────────────────────────────────────────────────────────

let animProgress  = 0
let animMode: 'in' | 'out' | 'shown' | 'idle' = 'idle'
let animRafId     = 0
let animStartTime = 0
let activeRobotIdx: number | null = null  // 사라짐 애니메이션 중에도 유지

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }
function easeInCubic(t:  number) { return t * t * t }

// ─── path helpers ─────────────────────────────────────────────────────────────

function roundRectPath(x: number, y: number, w: number, h: number, r: number | number[]) {
  if (!ctx) return
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r]
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.arcTo(x + w, y,     x + w, y + tr,   tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
  ctx.lineTo(x + bl, y + h)
  ctx.arcTo(x,     y + h, x,     y + h - bl, bl)
  ctx.lineTo(x,     y + tl)
  ctx.arcTo(x,     y,     x + tl, y,          tl)
  ctx.closePath()
}

// ─── label pill ──────────────────────────────────────────────────────────────

function drawPill(label: string, x: number, y: number, align: 'center' | 'left' | 'right' = 'center') {
  if (!ctx) return
  ctx.font = FONT
  const tw   = ctx.measureText(label).width
  const boxW = tw + PADDING_X * 2
  let bx = x - boxW / 2
  if (align === 'left')  bx = x
  if (align === 'right') bx = x - boxW
  const by = y - PILL_H / 2
  roundRectPath(bx, by, boxW, PILL_H, 5)
  ctx.fillStyle = 'rgba(15, 15, 30, 0.78)'
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.fillStyle    = '#dee2e6'
  ctx.fillText(label, bx + PADDING_X, y)
}

function drawCustomPill(
  robot: Robot,
  x: number,
  y: number,
  align: 'center' | 'left' | 'right' = 'center',
  selected = false,
) {
  if (!ctx) return
  const statusColor = STATUS_COLORS[robot.status] ?? '#868e96'
  const ICON_W  = 3
  const ICON_H  = 10
  const GAP     = 6
  const CPILL_H = 28
  const RING_R  = CPILL_H / 2 - 2
  const R_RIGHT = CPILL_H / 2
  const R_LEFT  = 5

  ctx.font = FONT
  const textW = ctx.measureText(`#${robot.id}`).width
  const boxW  = selected
    ? textW + PADDING_X * 2
    : PADDING_X + ICON_W + GAP + textW + GAP + CPILL_H
  const boxH = CPILL_H

  let bx = x - boxW / 2
  if (align === 'left')  bx = x
  if (align === 'right') bx = x - boxW
  const by = y - boxH / 2

  ctx.beginPath()
  ctx.roundRect(bx, by, boxW, boxH, selected ? R_LEFT : [R_LEFT, R_RIGHT, R_RIGHT, R_LEFT])
  ctx.fillStyle = 'rgba(15, 15, 30, 0.82)'
  ctx.fill()

  if (!selected) {
    ctx.beginPath()
    ctx.roundRect(bx, by, boxW, boxH, [R_LEFT, R_RIGHT, R_RIGHT, R_LEFT])
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth   = 1
    ctx.stroke()
  }

  if (selected) {
    ctx.font = FONT; ctx.fillStyle = '#dee2e6'; ctx.textBaseline = 'middle'
    ctx.fillText(`#${robot.id}`, bx + PADDING_X, y)
    return
  }

  const iconX = bx + PADDING_X
  const iconY = y - ICON_H / 2
  ctx.fillStyle = statusColor
  ctx.beginPath()
  ctx.roundRect(iconX, iconY, ICON_W, ICON_H, 1.5)
  ctx.fill()

  ctx.font = FONT; ctx.fillStyle = '#dee2e6'; ctx.textBaseline = 'middle'
  ctx.fillText(`#${robot.id}`, iconX + ICON_W + GAP, y)

  const ringCx = bx + boxW - R_RIGHT
  const ringCy = y
  const progress = (robot.workProgress ?? 0) / 100

  ctx.beginPath()
  ctx.arc(ringCx, ringCy, RING_R, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(ringCx, ringCy, RING_R - 1, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1.5; ctx.stroke()

  if (progress > 0) {
    ctx.beginPath()
    ctx.arc(ringCx, ringCy, RING_R - 1, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
    ctx.strokeStyle = statusColor; ctx.lineWidth = 1.5; ctx.stroke()
  }

  ctx.font = '8px/1 system-ui, sans-serif'
  ctx.fillStyle = 'rgba(220, 226, 230, 0.6)'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.fillText(String(robot.workProgress ?? 0), ringCx, ringCy)
  ctx.textAlign = 'left'
}

// ─── tooltip geometry helper ──────────────────────────────────────────────────

function getTooltipBoxHeight(robot: Robot): number {
  const active    = EFFECTS.filter(e => robot[e.key])
  const rowCount  = 4 + active.length   // 상태, 진행률, 위치, 빈줄구분, 활성효과들
  const dividerH  = active.length > 0 ? 10 : 0
  return TOOLTIP_PAD * 2 + rowCount * ROW_H + dividerH
}

function getBoxOrigin(sx: number, sy: number, boxH: number, w: number, _h: number) {
  const dir = sx < w * 0.55 ? 1 : -1
  const bx  = sx - TOOLTIP_W / 2 // 박스 중앙 = 로봇 x → 연결선 수직
  const by  = sy - BOX_OFFSET_Y - boxH / 2 // 툴팁 박스 상단 y 좌표
  // 선은 항상 박스 하단 정 중앙에 연결
  const anchorX = bx + TOOLTIP_W / 2
  const anchorY = by + boxH
  return { bx, by, anchorX, anchorY, dir }
}

// ─── tooltip 1: 타이틀 박스 내부 ─────────────────────────────────────────────

function drawTooltip1(robot: Robot, sx: number, sy: number, p: number) {
  if (!ctx) return
  const w        = appStore.containerWidth
  const h        = appStore.containerHeight
  const boxH     = getTooltipBoxHeight(robot) + TITLE_H
  const { bx, by, anchorX, anchorY, dir } = getBoxOrigin(sx, sy, boxH, w, h)
  const statusColor = STATUS_COLORS[robot.status] ?? '#868e96'

  // ── 직선 애니메이션 ──
  const tipX = sx + (anchorX - sx) * p
  const tipY = sy + (anchorY - sy) * p

  ctx.save()
  ctx.shadowColor = 'rgba(80,120,200,0.35)'
  ctx.shadowBlur  = 6
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth   = 1.5
  ctx.lineCap     = 'round'
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()
  ctx.restore()

  if (p < 0.45) return

  const boxAlpha  = Math.min((p - 0.45) / 0.45, 1)
  const scaleFrom = 0.88
  const scale     = scaleFrom + (1 - scaleFrom) * boxAlpha
  const pivotX    = bx + TOOLTIP_W / 2
  const pivotY    = by + boxH

  ctx.save()
  ctx.globalAlpha = boxAlpha
  ctx.translate(pivotX, pivotY)
  ctx.scale(scale, scale)
  ctx.translate(-pivotX, -pivotY)

  // 박스 배경 (오른쪽 모서리 크게 둥글게)
  roundRectPath(bx, by, TOOLTIP_W, boxH, dir > 0 ? [6, 14, 14, 6] : [14, 6, 6, 14])
  ctx.fillStyle = 'rgba(18, 18, 30, 0.8)'
  ctx.fill()

  // 박스 테두리
  roundRectPath(bx, by, TOOLTIP_W, boxH, dir > 0 ? [6, 14, 14, 6] : [14, 6, 6, 14])
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth   = 1
  ctx.stroke()

  // ── 타이틀 행 ──
  ctx.textBaseline = 'middle'
  ctx.font         = FONT_TITLE
  ctx.fillStyle    = '#f1f3f5'
  ctx.fillText(`Robot #${robot.id}`, bx + TOOLTIP_PAD, by + TITLE_H / 2)

  // 타이틀 행 우측 상태 dot
  const dotR = 5
  const dotX = bx + TOOLTIP_W - TOOLTIP_PAD - dotR
  const dotY = by + TITLE_H / 2
  ctx.beginPath()
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
  ctx.fillStyle = statusColor
  ctx.fill()

  // 타이틀 구분선
  ctx.beginPath()
  ctx.moveTo(bx + TOOLTIP_PAD, by + TITLE_H)
  ctx.lineTo(bx + TOOLTIP_W - TOOLTIP_PAD, by + TITLE_H)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth   = 1
  ctx.stroke()

  // ── 내용 행 ──
  let ry = by + TITLE_H + TOOLTIP_PAD
  drawContentRows(robot, bx, ry, statusColor)

  ctx.restore()
}

// ─── tooltip 2: 타이틀 박스 외부 ─────────────────────────────────────────────

function drawTooltip2(robot: Robot, sx: number, sy: number, p: number) {
  if (!ctx) return
  const w        = appStore.containerWidth
  const h        = appStore.containerHeight
  const boxH     = getTooltipBoxHeight(robot)
  const { bx, by, anchorX, anchorY, dir } = getBoxOrigin(sx, sy, boxH, w, h)
  const statusColor = STATUS_COLORS[robot.status] ?? '#868e96'

  // ── 직선 애니메이션 ──
  const tipX = sx + (anchorX - sx) * p
  const tipY = sy + (anchorY - sy) * p

  ctx.save()
  ctx.shadowColor = 'rgba(80,120,200,0.35)'
  ctx.shadowBlur  = 6
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth   = 1.5
  ctx.lineCap     = 'round'
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()
  ctx.restore()

  if (p < 0.45) return

  const boxAlpha  = Math.min((p - 0.45) / 0.45, 1)
  const scaleFrom = 0.88
  const scale     = scaleFrom + (1 - scaleFrom) * boxAlpha
  const pivotX    = bx + TOOLTIP_W / 2
  const pivotY    = by + boxH

  ctx.save()
  ctx.globalAlpha = boxAlpha
  ctx.translate(pivotX, pivotY)
  ctx.scale(scale, scale)
  ctx.translate(-pivotX, -pivotY)

  // ── 외부 타이틀 텍스트 (박스 위, 우측 정렬) ──
  const TITLE_OFFSET_Y = 20
  ctx.font         = FONT_TITLE
  ctx.fillStyle    = '#f1f3f5'
  ctx.textBaseline = 'middle'
  ctx.textAlign    = dir > 0 ? 'right' : 'left'
  ctx.fillText(`Robot #${robot.id}`, dir > 0 ? bx + TOOLTIP_W : bx, by - TITLE_OFFSET_Y / 2)
  ctx.textAlign = 'left'

  // 상태 dot (타이틀 옆)
  const titleW = ctx.measureText(`Robot #${robot.id}`).width
  const dotR   = 4
  const dotX   = dir > 0
    ? bx + TOOLTIP_W - titleW - dotR * 3 - 4
    : bx + titleW + dotR * 2
  const dotY = by - TITLE_OFFSET_Y / 2
  ctx.beginPath()
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
  ctx.fillStyle = statusColor
  ctx.fill()

  // 박스 배경
  roundRectPath(bx, by, TOOLTIP_W, boxH, dir > 0 ? [6, 14, 14, 6] : [14, 6, 6, 14])
  ctx.fillStyle = 'rgba(18, 18, 30, 0.8)'
  ctx.fill()

  // 박스 테두리
  roundRectPath(bx, by, TOOLTIP_W, boxH, dir > 0 ? [6, 14, 14, 6] : [14, 6, 6, 14])
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth   = 1
  ctx.stroke()

  // ── 내용 행 ──
  drawContentRows(robot, bx, by + TOOLTIP_PAD, statusColor)

  ctx.restore()
}

// ─── shared content rows ──────────────────────────────────────────────────────

function drawContentRows(robot: Robot, bx: number, startY: number, statusColor: string) {
  if (!ctx) return
  let ry = startY

  // 상태 행
  ctx.font      = FONT_SMALL
  ctx.fillStyle = 'rgba(134, 142, 150, 0.8)'
  ctx.textBaseline = 'middle'
  ctx.fillText('상태', bx + TOOLTIP_PAD, ry + ROW_H / 2)

  ctx.font      = FONT_SMALL
  ctx.fillStyle = statusColor
  ctx.textAlign = 'right'
  ctx.fillText(STATUS_LABEL[robot.status] ?? robot.status, bx + TOOLTIP_W - TOOLTIP_PAD, ry + ROW_H / 2)
  ctx.textAlign = 'left'
  ry += ROW_H

  // 진행률 행
  ctx.font      = FONT_SMALL
  ctx.fillStyle = 'rgba(134, 142, 150, 0.8)'
  ctx.fillText('진행률', bx + TOOLTIP_PAD, ry + ROW_H / 2)

  const barW   = 60
  const barH   = 4
  const barX   = bx + TOOLTIP_W - TOOLTIP_PAD - barW
  const barY   = ry + ROW_H / 2 - barH / 2
  const prog   = (robot.workProgress ?? 0) / 100

  ctx.beginPath()
  ctx.roundRect(barX, barY, barW, barH, 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fill()

  if (prog > 0) {
    ctx.beginPath()
    ctx.roundRect(barX, barY, barW * prog, barH, 2)
    ctx.fillStyle = statusColor
    ctx.fill()
  }

  ctx.font      = '10px/1 system-ui, sans-serif'
  ctx.fillStyle = '#adb5bd'
  ctx.textAlign = 'right'
  ctx.fillText(`${robot.workProgress ?? 0}%`, barX - 6, ry + ROW_H / 2)
  ctx.textAlign = 'left'
  ry += ROW_H

  // 위치 행
  ctx.font      = FONT_SMALL
  ctx.fillStyle = 'rgba(134, 142, 150, 0.8)'
  ctx.fillText('위치', bx + TOOLTIP_PAD, ry + ROW_H / 2)

  ctx.font      = '11px/1 monospace, sans-serif'
  ctx.fillStyle = '#adb5bd'
  ctx.textAlign = 'right'
  ctx.fillText(
    `(${robot.x.toFixed(1)}, ${robot.y.toFixed(1)}, ${robot.z.toFixed(1)})`,
    bx + TOOLTIP_W - TOOLTIP_PAD,
    ry + ROW_H / 2,
  )
  ctx.textAlign = 'left'
  ry += ROW_H

  // 활성 효과
  const active = EFFECTS.filter(e => robot[e.key])
  if (active.length > 0) {
    ry += 3
    ctx.beginPath()
    ctx.moveTo(bx + TOOLTIP_PAD, ry)
    ctx.lineTo(bx + TOOLTIP_W - TOOLTIP_PAD, ry)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth   = 1
    ctx.stroke()
    ry += 7

    ctx.font      = '11px/1 system-ui, sans-serif'
    ctx.fillStyle = 'rgba(134, 142, 150, 0.7)'
    for (const e of active) {
      ctx.fillText(`· ${e.label}`, bx + TOOLTIP_PAD, ry + ROW_H / 2)
      ry += ROW_H
    }
  }
}

// ─── main draw ────────────────────────────────────────────────────────────────

function draw() {
  if (!ctx) return
  const w   = appStore.containerWidth
  const h   = appStore.containerHeight

  ctx.clearRect(0, 0, w, h)
  if (appStore.mode !== 'monitoring') return

  ctx.font = FONT

  // ── 일반 라벨 (activeRobot 제외) ─────────────────────────────────────────
  for (let i = 0; i < mapStore.robots.length; i++) {
    if (i === activeRobotIdx) continue
    const robot = mapStore.robots[i]
    const pt    = mapStore.projectedRobots.get(robot.id)
    if (!pt) continue
    const { x: sx, y: sy } = pt
    if (sx < -200 || sx > w + 200 || sy < -200 || sy > h + 200) continue

    const sy_offset = sy - 20
    if (mapStore.labelType === 'custom') {
      drawCustomPill(robot, sx, sy_offset)
    } else {
      drawPill(`#${robot.id}`, sx, sy_offset)
    }
  }

  // ── 선택/사라짐 툴팁 ─────────────────────────────────────────────────────
  if (activeRobotIdx === null) return
  const robot = mapStore.robots[activeRobotIdx]
  if (!robot) return
  const pt = mapStore.projectedRobots.get(robot.id)
  if (!pt) return
  const { x: sx, y: sy } = pt
  if (sx < -200 || sx > w + 200 || sy < -200 || sy > h + 200) return

  const p = animProgress

  if (mapStore.tooltipType === 'tooltip2') {
    drawTooltip2(robot, sx, sy, p)
  } else {
    drawTooltip1(robot, sx, sy, p)
  }
}

// ─── animation ────────────────────────────────────────────────────────────────

function startEnterAnim() {
  animMode      = 'in'
  animStartTime = performance.now()
  animProgress  = 0

  function step() {
    const raw    = Math.min((performance.now() - animStartTime) / ANIM_ENTER_MS, 1)
    animProgress = easeOutCubic(raw)
    draw()
    if (raw < 1) {
      animRafId = requestAnimationFrame(step)
    } else {
      animMode = 'shown'
    }
  }
  animRafId = requestAnimationFrame(step)
}

function startExitAnim() {
  animMode      = 'out'
  animStartTime = performance.now()
  const startP  = animProgress  // 현재 progress에서 시작 (중간 상태에서도 자연스럽게)

  function step() {
    const raw    = Math.min((performance.now() - animStartTime) / ANIM_EXIT_MS, 1)
    animProgress = startP * (1 - easeInCubic(raw))
    draw()
    if (raw < 1) {
      animRafId = requestAnimationFrame(step)
    } else {
      animProgress  = 0
      animMode      = 'idle'
      activeRobotIdx = null
      draw()
    }
  }
  animRafId = requestAnimationFrame(step)
}

// ─── resize ───────────────────────────────────────────────────────────────────

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width  = appStore.containerWidth
  canvas.height = appStore.containerHeight
  draw()
}

// ─── watchers ─────────────────────────────────────────────────────────────────

watch(() => mapStore.projectedVersion, draw)
watch(() => mapStore.robotVersion,     draw)

watch(() => appStore.selectedRobotId, (newId, oldId) => {
  cancelAnimationFrame(animRafId)

  if (newId !== null) {
    // 다른 로봇 선택 or 처음 선택 → 즉시 교체
    activeRobotIdx = newId
    startEnterAnim()
  } else {
    // 선택 해제 → 사라짐 애니메이션 (oldId 로봇 유지)
    activeRobotIdx = oldId
    startExitAnim()
  }
})

watch(() => appStore.mode, () => { resize(); draw() })
watch(() => [appStore.containerWidth, appStore.containerHeight], resize)

onMounted(() => {
  ctx = canvasRef.value?.getContext('2d') ?? null
  resize()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animRafId)
  ctx = null
})
</script>

<template>
  <canvas ref="canvasRef" class="label-canvas" />
</template>

<style scoped>
.label-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
