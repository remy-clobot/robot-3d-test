<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'

const appStore = useAppStore()
const mapStore = useMapStore()

const selectedNodeId = ref<number | null>(null)

// 편집 모드용 2D 뷰포트 변환 (맵 좌표 → 스크린 좌표)
const editScale = 40
const editOffset = computed(() => ({
  x: appStore.containerWidth / 2,
  y: appStore.containerHeight / 2,
}))

function toScreenX(worldX: number): number {
  if (appStore.mode === 'monitoring') {
    return 0 // 모니터링 모드에선 projectedNodes 사용
  }
  return worldX * editScale + editOffset.value.x
}

function toScreenY(worldY: number): number {
  if (appStore.mode === 'monitoring') {
    return 0
  }
  return worldY * editScale + editOffset.value.y
}

// 모니터링 모드: Three.js 투영 좌표, 편집 모드: 자체 2D 변환
function nodeScreenPos(nodeId: number) {
  if (appStore.mode === 'monitoring') {
    const p = mapStore.projectedNodes.get(nodeId)
    return p ?? { x: 0, y: 0 }
  }
  const node = mapStore.getNode(nodeId)
  if (!node) return { x: 0, y: 0 }
  return { x: toScreenX(node.x), y: toScreenY(node.y) }
}

const nodeConfigs = computed(() => {
  // projectedNodes is a raw Map; depend on projectedVersion so this recomputes
  // exactly once per render frame (not once per node per frame)
  void mapStore.projectedVersion
  return mapStore.nodes.map((node) => {
    const pos = nodeScreenPos(node.id)
    return {
      id: node.id,
      x: pos.x,
      y: pos.y,
      radius: appStore.mode === 'editing' ? 12 : 8,
      fill: selectedNodeId.value === node.id ? '#ffd43b' : '#4dabf7',
      stroke: '#ffffff',
      strokeWidth: 2,
      draggable: appStore.mode === 'editing',
      label: node.label ?? `${node.id}`,
    }
  })
})

const linkConfigs = computed(() => {
  void mapStore.projectedVersion
  return mapStore.links.map((link) => {
    const from = nodeScreenPos(link.from)
    const to = nodeScreenPos(link.to)
    return {
      id: link.id,
      points: [from.x, from.y, to.x, to.y],
      stroke: '#868e96',
      strokeWidth: 2,
      dash: [6, 4],
    }
  })
})

const stageConfig = computed(() => ({
  width: appStore.containerWidth,
  height: appStore.containerHeight,
}))

function onNodeClick(nodeId: number) {
  if (appStore.mode !== 'editing') return
  selectedNodeId.value = selectedNodeId.value === nodeId ? null : nodeId
}

function onNodeDragEnd(nodeId: number, e: any) {
  if (appStore.mode !== 'editing') return
  const target = e.target
  const node = mapStore.getNode(nodeId)
  if (!node) return
  // 스크린 좌표 → 맵 좌표 역변환
  node.x = (target.x() - editOffset.value.x) / editScale
  node.y = (target.y() - editOffset.value.y) / editScale
}
</script>

<template>
  <div
    class="konva-overlay"
    :style="{
      pointerEvents: appStore.mode === 'monitoring' ? 'none' : 'auto',
    }"
  >
    <v-stage :config="stageConfig">
      <v-layer>
        <!-- Links -->
        <v-line
          v-for="link in linkConfigs"
          :key="link.id"
          :config="{
            points: link.points,
            stroke: link.stroke,
            strokeWidth: link.strokeWidth,
            dash: link.dash,
          }"
        />
        <!-- Nodes -->
        <v-circle
          v-for="node in nodeConfigs"
          :key="node.id"
          :config="{
            x: node.x,
            y: node.y,
            radius: node.radius,
            fill: node.fill,
            stroke: node.stroke,
            strokeWidth: node.strokeWidth,
            draggable: node.draggable,
          }"
          @click="onNodeClick(node.id)"
          @dragend="onNodeDragEnd(node.id, $event)"
        />
        <!-- Node Labels -->
        <v-text
          v-for="node in nodeConfigs"
          :key="'label-' + node.id"
          :config="{
            x: node.x - 4,
            y: node.y + (appStore.mode === 'editing' ? 16 : 12),
            text: node.label,
            fontSize: 12,
            fill: '#dee2e6',
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
