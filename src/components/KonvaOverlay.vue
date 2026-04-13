<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'

const appStore = useAppStore()
const mapStore = useMapStore()

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
        //stroke:      'rgba(42, 108, 200, 0.50)',
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
  })
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
<!--        <v-rect :config="mapPlaneConfig" />-->
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

<!--                <v-circle-->
<!--                  v-for="node in nodeConfigs"-->
<!--                  :key="node.id"-->
<!--                  :config="{-->
<!--                    x: node.x, y: node.y,-->
<!--                    radius: 10,-->
<!--                    //rotation: node.rotation,-->
<!--                    fill: node.fill,-->
<!--                    stroke: node.stroke,-->
<!--                    strokeWidth: node.strokeWidth,-->
<!--                    draggable: node.draggable,-->
<!--                  }"-->
<!--                  @click="onNodeClick(node.id)"-->
<!--                  @dragend="onNodeDragEnd(node.id, $event)"-->
<!--                />-->


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

    </v-stage>
  </div>
</template>

<style scoped>
.konva-overlay {
  position: absolute;
  inset: 0;
}
</style>
