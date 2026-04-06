<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'

const appStore = useAppStore()
const mapStore = useMapStore()

const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null

// ─── visual constants ─────────────────────────────────────────────────────────

const FONT       = '14px/1 system-ui, sans-serif'
const FONT_SMALL = '12px/1 system-ui, sans-serif'


// robot name badge
const PILL_H     = 22
const PILL_GAP   = 0     // gap between pill bottom and line (= anchor offset from sy)
const PADDING_X  = 8     // badge padding

// line
const V          = 100    // vertical segment (px up)
const H          = 200   // horizontal segment
const SLOPE      = 30    // 얼마나 꺾일지

// tooltip box
const TOOLTIP_W  = 152 // width
const ROW_H      = 22 // height for each row
const BOX_PAD    = 10 // padding

// animation
const ANIM_MS    = 400 // duration

const STATUS_LABEL: Record<string, string> = {
  normal:  '정상',
  warning: '경고',
  error:   '오류',
}
const EFFECTS = [
  { key: 'blink'       as const, label: 'Blink'       },
  { key: 'errorMarker' as const, label: 'Error Marker' },
  { key: 'shadowDisc'  as const, label: 'Shadow Disc'  },
]

// ─── animation state ──────────────────────────────────────────────────────────

let animProgress  = 0
let animRafId     = 0
let animStartTime = 0

function easeOut(t: number) { return 1 - Math.pow(1 - t, 3) }

// ─── path helpers ─────────────────────────────────────────────────────────────

/** Position along bent line (anchor→corner→end) at normalized t. */
function getPointOnPath(
  ax: number, ay: number,
  cx: number, cy: number,
  ex: number, ey: number,
  t: number,
): { x: number; y: number } {
  const seg1 = Math.hypot(cx - ax, cy - ay)
  const seg2 = Math.hypot(ex - cx, ey - cy)
  const dist  = t * (seg1 + seg2)
  if (dist <= seg1) {
    const f = seg1 === 0 ? 0 : dist / seg1
    return { x: ax + (cx - ax) * f, y: ay + (cy - ay) * f }
  }
  const f = seg2 === 0 ? 0 : (dist - seg1) / seg2
  return { x: cx + (ex - cx) * f, y: cy + (ey - cy) * f }
}

/** Draw a rounded-rect path (no fill/stroke). */
function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
  if (!ctx) return
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,     x + w, y + r,     r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x,     y + h, x,     y + h - r, r)
  ctx.lineTo(x,     y + r)
  ctx.arcTo(x,     y,     x + r, y,         r)
  ctx.closePath()
}

/** Draw a label pill centered at (cx, cy). */
function drawPill(
    label: string,
    x: number,
    y: number,
    align: 'center' | 'left' | 'right' = 'center'
) {
  if (!ctx) return
  ctx.font = FONT
  const tw   = ctx.measureText(label).width
  const boxW = tw + PADDING_X * 2

  // 정렬 기준에 따라 박스의 시작점(bx) 계산
  let bx = x - boxW / 2           // 기본값: 중앙 정렬
  if (align === 'left') bx = x    // 좌측 정렬: x에서 시작
  if (align === 'right') bx = x - boxW // 우측 정렬: x에서 끝남

  const by = y - PILL_H / 2

  roundRectPath(bx, by, boxW, PILL_H, 5)
  ctx.fillStyle = 'rgba(15, 15, 30, 0.78)'
  ctx.fill()

  ctx.textBaseline = 'middle'
  ctx.fillStyle    = '#dee2e6'
  ctx.fillText(label, bx + PADDING_X, y)
}

// ─── main draw ────────────────────────────────────────────────────────────────

function draw() {
  if (!ctx) return
  const w      = appStore.containerWidth
  const h      = appStore.containerHeight
  const selIdx = appStore.selectedRobotId

  ctx.clearRect(0, 0, w, h)
  if (appStore.mode !== 'monitoring') return

  ctx.font = FONT

  // ── regular labels (skip selected robot) ──────────────────────────────────
  for (let i = 0; i < mapStore.robots.length; i++) {
    if (i === selIdx) continue
    const robot = mapStore.robots[i]
    const pt    = mapStore.projectedRobots.get(robot.id)
    if (!pt) continue
    const { x: sx, y: sy } = pt
    if (sx < -200 || sx > w + 200 || sy < -200 || sy > h + 200) continue

    //drawPill(`#${robot.id}`, sx, sy - PILL_GAP - PILL_H / 2)
    drawPill(`#${robot.id}`, sx, sy)
  }

  // ── selected robot tooltip ─────────────────────────────────────────────────
  if (selIdx === null) return
  const robot = mapStore.robots[selIdx]
  if (!robot) return
  const pt = mapStore.projectedRobots.get(robot.id)
  if (!pt) return
  const { x: sx, y: sy } = pt
  if (sx < -200 || sx > w + 200 || sy < -200 || sy > h + 200) return

  const p   = animProgress
  const dir = sx < w * 0.6 ? 1 : -1

  // Bent line geometry
  // Line starts at bottom of where the label pill would be
  const ax = sx
  const ay = sy
  //const ay = sy - PILL_GAP - PILL_H / 2   // label-center height = line start

  const cx = ax + SLOPE * dir
  const cy = ay - V

  const ex = ax + dir * H
  const ey = cy                            // horizontal line y

  // ── white bent line, drawn up to current progress ──────────────────────
  const tip = getPointOnPath(ax, ay, cx, cy, ex, ey, p)

  ctx.save()
  ctx.shadowColor = '#3a7578'
  ctx.shadowBlur = 5

  //ctx.strokeStyle = '#00f3ff' // 👈 네온 파랑색 (Cyan 계열)
   ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth   = 1.5
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'
  ctx.beginPath()
  ctx.moveTo(ax, ay)

  const distDone = p * (V + H)
  if (distDone <= V) {
    ctx.lineTo(tip.x, tip.y)
  } else {
    ctx.lineTo(cx, cy)
    ctx.lineTo(tip.x, tip.y)
  }
  ctx.stroke()
  ctx.restore()

  // ── robot name label — appears above the line end (top-right of the L) ──
  //    fades in as the horizontal segment draws
  const horzFraction = distDone <= V ? 0 : (distDone - V) / H
  if (horzFraction > 0) {
    const labelCy = ey - PILL_H / 2 - 4

    // 선이 오른쪽(1)으로 뻗으면 배지는 선의 끝점에서 끝나야 하므로 'right' 정렬
    // 선이 왼쪽(-1)으로 뻗으면 배지는 선의 끝점에서 시작해야 하므로 'left' 정렬
    const align = dir > 0 ? 'right' : 'left'

    ctx.save()
    ctx.globalAlpha = Math.min(horzFraction / 0.5, 1)

    // tip.x를 그대로 넘기면서 align 옵션만 부여
    drawPill(`#${robot.id}`, tip.x, labelCy, align)

    ctx.restore()
  }

  // ── tooltip detail box — attached directly below the horizontal line ────
  //    fades in once the line is ~70% done
  if (p > 0.7) {
    const boxAlpha = Math.min((p - 0.7) / 0.3, 1)

    const active = EFFECTS.filter(e => robot[e.key])
    const rowCount = 1 + active.length
    const dividerH = active.length > 0 ? 10 : 0
    const boxH = BOX_PAD * 2 + rowCount * ROW_H + dividerH

    const offset_x = (dir>0)? TOOLTIP_W : 0
    const offset_y = 1
    // Box anchored to the line end, top edge flush with horizontal line
    const bx = ex - offset_x
    const by = ey + offset_y     // no gap — box top is at the line y

    ctx.save()
    ctx.globalAlpha = boxAlpha

    // Background
    roundRectPath(bx, by, TOOLTIP_W, boxH, 6)
    ctx.fillStyle = 'rgba(12, 12, 18, 0.92)'
    ctx.fill()

    // Thin top border matching the line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(bx + 6, by)
    ctx.lineTo(bx + TOOLTIP_W - 6, by)
    ctx.stroke()

    ctx.textBaseline = 'middle'
    let ry = by + BOX_PAD

    // Status row
    ctx.font      = FONT
    ctx.fillStyle = '#e8e8e8'
    ctx.fillText(STATUS_LABEL[robot.status] ?? robot.status, bx + BOX_PAD, ry + ROW_H / 2)
    ry += ROW_H

    // Effects (if any)
    if (active.length > 0) {
      ry += 3
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(bx + BOX_PAD, ry)
      ctx.lineTo(bx + TOOLTIP_W - BOX_PAD, ry)
      ctx.stroke()
      ry += 7

      ctx.font      = FONT_SMALL
      ctx.fillStyle = '#888'
      for (const e of active) {
        ctx.fillText(e.label, bx + BOX_PAD, ry + ROW_H / 2)
        ry += ROW_H
      }
    }

    ctx.restore()
  }
}

// ─── animation ────────────────────────────────────────────────────────────────

function startAnim() {
  cancelAnimationFrame(animRafId)
  animStartTime = performance.now()
  animProgress  = 0

  function step() {
    const raw = Math.min((performance.now() - animStartTime) / ANIM_MS, 1)
    animProgress = easeOut(raw)
    draw()
    if (raw < 1) animRafId = requestAnimationFrame(step)
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
watch(() => appStore.selectedRobotId, (newId) => {
  cancelAnimationFrame(animRafId)
  if (newId !== null) {
    startAnim()
  } else {
    animProgress = 0
    draw()
  }
})
watch(() => appStore.mode,                                       () => { resize(); draw() })
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
