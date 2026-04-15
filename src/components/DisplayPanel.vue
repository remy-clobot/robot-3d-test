<script setup lang="ts">
import { useAppStore } from '../stores/appStore'
import { useMapStore } from '../stores/mapStore'

const appStore = useAppStore()
const mapStore = useMapStore()

function setLabelType(value: 'default' | 'custom') {
  mapStore.labelType = value
  mapStore.robotVersion++
}

function setTooltipType(value: 'tooltip1' | 'tooltip2') {
  mapStore.tooltipType = value
  mapStore.robotVersion++
}

function togglePointCloud() {
  appStore.pointCloudVisible = !appStore.pointCloudVisible
}

function toggleMapImage() {
  appStore.mapImageVisible = !appStore.mapImageVisible
}

function toggleOutline() {
  appStore.outlineVisible = !appStore.outlineVisible
  mapStore.robotVersion++
}
</script>

<template>
  <div class="display-panel">
    <div class="panel-title">디스플레이</div>

    <div class="divider" />

    <div class="panel-section">
      <div class="info-row">
        <span class="label">라벨</span>
        <div class="btn-group">
          <button
            class="opt-btn"
            :class="{ active: mapStore.labelType === 'default' }"
            style="--color: #74c0fc"
            @click="setLabelType('default')"
          >디폴트</button>
          <button
            class="opt-btn"
            :class="{ active: mapStore.labelType === 'custom' }"
            style="--color: #74c0fc"
            @click="setLabelType('custom')"
          >커스텀</button>
        </div>
      </div>

      <div class="info-row">
        <span class="label">툴팁</span>
        <div class="btn-group">
          <button
            class="opt-btn"
            :class="{ active: mapStore.tooltipType === 'tooltip1' }"
            style="--color: #a9e34b"
            @click="setTooltipType('tooltip1')"
          >타입 1</button>
          <button
            class="opt-btn"
            :class="{ active: mapStore.tooltipType === 'tooltip2' }"
            style="--color: #a9e34b"
            @click="setTooltipType('tooltip2')"
          >타입 2</button>
        </div>
      </div>

      <div class="info-row">
        <span class="label">포인트 클라우드</span>
        <button
          class="toggle-btn"
          :class="{ on: appStore.pointCloudVisible }"
          @click="togglePointCloud"
        >
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-label">{{ appStore.pointCloudVisible ? 'ON' : 'OFF' }}</span>
        </button>
      </div>

      <div class="info-row">
        <span class="label">맵 이미지</span>
        <button
          class="toggle-btn"
          :class="{ on: appStore.mapImageVisible }"
          @click="toggleMapImage"
        >
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-label">{{ appStore.mapImageVisible ? 'ON' : 'OFF' }}</span>
        </button>
      </div>

      <div class="info-row">
        <span class="label">아웃라인</span>
        <button
          class="toggle-btn"
          :class="{ on: appStore.outlineVisible }"
          @click="toggleOutline"
        >
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-label">{{ appStore.outlineVisible ? 'ON' : 'OFF' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.display-panel {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 100;
  width: 280px;
  background: rgba(15, 15, 30, 0.88);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #dee2e6;
  font-size: 13px;
  overflow: hidden;
}

.panel-title {
  padding: 10px 14px 8px;
  font-weight: 600;
  font-size: 14px;
  color: #f8f9fa;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
}

.panel-section {
  padding: 8px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  width: 110px;
}

.btn-group {
  display: flex;
  gap: 4px;
}

.opt-btn {
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: #adb5bd;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}
.opt-btn:hover {
  border-color: var(--color);
  color: var(--color);
}
.opt-btn.active {
  background: var(--color);
  border-color: var(--color);
  color: #fff;
  font-weight: 600;
}

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
</style>
