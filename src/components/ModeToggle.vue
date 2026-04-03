<script setup lang="ts">
import { useAppStore } from '../stores/appStore'

const appStore = useAppStore()
</script>

<template>
  <div class="mode-toggle">
    <button
      :class="['toggle-btn', { active: appStore.mode === 'monitoring' }]"
      @click="appStore.mode = 'monitoring'"
    >
      🔍 모니터링
    </button>
    <button
      :class="['toggle-btn', { active: appStore.mode === 'editing' }]"
      @click="appStore.mode = 'editing'"
    >
      ✏️ 맵 편집
    </button>
    <span class="mode-indicator">{{ appStore.mode === 'monitoring' ? 'Three.js 활성' : 'Konva 활성' }}</span>
  </div>
</template>

<style scoped>
.mode-toggle {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  padding: 8px 12px;
  border-radius: 8px;
}

.toggle-btn {
  padding: 6px 14px;
  border: 1px solid #495057;
  border-radius: 6px;
  background: transparent;
  color: #adb5bd;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.toggle-btn.active {
  background: #228be6;
  border-color: #228be6;
  color: #fff;
}

.mode-indicator {
  color: #868e96;
  font-size: 12px;
  margin-left: 8px;
}
</style>
