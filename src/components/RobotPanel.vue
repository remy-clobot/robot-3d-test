<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'
import { type RobotStatus } from '../data/sampleData'

const appStore = useAppStore()
const mapStore = useMapStore()

const robot = computed(() => {
  const idx = appStore.selectedRobotId
  if (idx === null) return null
  return mapStore.robots[idx] ?? null
})

function close() {
  appStore.selectedRobotId = null
}

function setStatus(value: string) {
  if (!robot.value) return
  robot.value.status = value as RobotStatus
  mapStore.robotVersion++
}

function toggleBlink() {
  if (!robot.value) return
  robot.value.blink = !robot.value.blink
  mapStore.robotVersion++
}

function toggleErrorMarker() {
  if (!robot.value) return
  robot.value.errorMarker = !robot.value.errorMarker
  mapStore.robotVersion++
}

function toggleShadowDisc() {
  if (!robot.value) return
  robot.value.shadowDisc = !robot.value.shadowDisc
  mapStore.robotVersion++
}

function setWorkProgress(value: number) {
  if (!robot.value) return
  robot.value.workProgress = Math.max(0, Math.min(100, value))
  mapStore.robotVersion++
}

const statusOptions: { value: RobotStatus; label: string; color: string }[] = [
  { value: 'normal',  label: '정상',  color: '#2ecc71' },
  { value: 'warning', label: '경고',  color: '#f39c12' },
  { value: 'error',   label: '오류',  color: '#e74c3c' },
]

const statusColor = computed(() => {
  const s = robot.value?.status
  return statusOptions.find((o) => o.value === s)?.color ?? '#868e96'
})
</script>

<template>
  <Transition name="panel">
    <div v-if="robot" class="robot-panel">
      <!-- Header -->
      <div class="panel-header">
        <span class="panel-title">Robot #{{ robot.id }}</span>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <!-- Static info -->
      <div class="panel-section">
        <div class="info-row">
          <span class="label">타입</span>
          <span class="value">{{ robot.type }}</span>
        </div>
        <div class="info-row">
          <span class="label">위치</span>
          <span class="value mono">
            ({{ robot.x.toFixed(1) }}, {{ robot.y.toFixed(1) }}, {{ robot.z.toFixed(1) }})
          </span>
        </div>
      </div>

      <div class="divider" />

      <!-- Editable fields -->
      <div class="panel-section">
        <!-- Work progress (custom label only) -->
        <div v-if="mapStore.labelType === 'custom'" class="info-row">
          <span class="label">진행률</span>
          <div class="progress-row">
            <input
              type="range"
              min="0"
              max="100"
              :value="robot.workProgress"
              :style="{ accentColor: statusColor }"
              @input="setWorkProgress(+($event.target as HTMLInputElement).value)"
            />
            <span class="value">{{ robot.workProgress }}%</span>
          </div>
        </div>

        <!-- Status -->
        <div class="info-row">
          <span class="label">상태</span>
          <div class="status-selector">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              class="status-btn"
              :class="{ active: robot.status === opt.value }"
              :style="{ '--status-color': opt.color }"
              @click="setStatus(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Blink -->
        <div class="info-row">
          <span class="label">블링크</span>
          <button
            class="toggle-btn"
            :class="{ on: robot.blink }"
            @click="toggleBlink"
          >
            <span class="toggle-track">
              <span class="toggle-thumb" />
            </span>
            <span class="toggle-label">{{ robot.blink ? 'ON' : 'OFF' }}</span>
          </button>
        </div>

        <!-- Error Marker -->
        <div class="info-row">
          <span class="label">에러마커</span>
          <button
            class="toggle-btn"
            :class="{ on: robot.errorMarker }"
            @click="toggleErrorMarker"
          >
            <span class="toggle-track">
              <span class="toggle-thumb" />
            </span>
            <span class="toggle-label">{{ robot.errorMarker ? 'ON' : 'OFF' }}</span>
          </button>
        </div>

        <!-- Shadow Disc -->
        <div class="info-row">
          <span class="label">그림자</span>
          <button
            class="toggle-btn"
            :class="{ on: robot.shadowDisc }"
            @click="toggleShadowDisc"
          >
            <span class="toggle-track">
              <span class="toggle-thumb" />
            </span>
            <span class="toggle-label">{{ robot.shadowDisc ? 'ON' : 'OFF' }}</span>
          </button>
        </div>
      </div>

      <!-- Status dot footer -->
      <div class="panel-footer">
        <span class="status-dot" :style="{ background: statusColor }" />
        <span class="status-text" :style="{ color: statusColor }">
          {{ statusOptions.find((o) => o.value === robot?.status)?.label }}
        </span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.robot-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 100;
  width: 240px;
  background: rgba(15, 15, 30, 0.88);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #dee2e6;
  font-size: 13px;
  overflow: hidden;
}

/* ─── header ─────────────────────────────── */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #f8f9fa;
}

.close-btn {
  background: none;
  border: none;
  color: #868e96;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.close-btn:hover {
  color: #f8f9fa;
  background: rgba(255, 255, 255, 0.08);
}

/* ─── sections ───────────────────────────── */
.panel-section {
  padding: 8px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
  margin: 0;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.label {
  color: #868e96;
  flex-shrink: 0;
  width: 60px;
}

.value {
  color: #dee2e6;
  text-align: right;
}
.value.mono {
  font-family: monospace;
  font-size: 12px;
  color: #adb5bd;
}

/* ─── progress row ───────────────────────── */
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-row input[type='range'] {
  width: 90px;
  cursor: pointer;
}

/* ─── status buttons ─────────────────────── */
.status-selector {
  display: flex;
  gap: 4px;
}

.status-btn {
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: #adb5bd;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}
.status-btn:hover {
  border-color: var(--status-color);
  color: var(--status-color);
}
.status-btn.active {
  background: var(--status-color);
  border-color: var(--status-color);
  color: #fff;
  font-weight: 600;
}

/* ─── toggle switch ──────────────────────── */
.toggle-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.toggle-track {
  position: relative;
  display: block;
  width: 30px;
  height: 16px;
  border-radius: 8px;
  background: #343a40;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
}
.toggle-btn.on .toggle-track {
  background: #228be6;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #adb5bd;
  transition: transform 0.2s, background 0.2s;
}
.toggle-btn.on .toggle-thumb {
  transform: translateX(14px);
  background: #fff;
}

.toggle-label {
  font-size: 11px;
  color: #868e96;
  width: 22px;
}
.toggle-btn.on .toggle-label {
  color: #74c0fc;
}

/* ─── footer ─────────────────────────────── */
.panel-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-text {
  font-size: 11px;
  font-weight: 600;
}

/* ─── transition ─────────────────────────── */
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
