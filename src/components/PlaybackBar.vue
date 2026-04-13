<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { usePlaybackStore } from '../stores/playbackStore'

const playback = usePlaybackStore()

const trackRef = ref<HTMLDivElement>()
let isDragging = false

// ─── seek ──────────────────────────────────────────────────────────────────

function getProgress(e: MouseEvent): number {
  if (!trackRef.value) return 0
  const rect = trackRef.value.getBoundingClientRect()
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

function onTrackMouseDown(e: MouseEvent) {
  isDragging = true
  playback.seekByProgress(getProgress(e))
  window.addEventListener('mousemove', onWindowMove)
  window.addEventListener('mouseup',  onWindowUp)
}

function onWindowMove(e: MouseEvent) {
  if (isDragging) playback.seekByProgress(getProgress(e))
}

function onWindowUp(e: MouseEvent) {
  if (!isDragging) return
  isDragging = false
  playback.seekByProgress(getProgress(e))
  window.removeEventListener('mousemove', onWindowMove)
  window.removeEventListener('mouseup',  onWindowUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onWindowMove)
  window.removeEventListener('mouseup',  onWindowUp)
})

// ─── frame display ─────────────────────────────────────────────────────────

function padded(n: number, len = 3) {
  return String(n).padStart(len, '0')
}
</script>

<template>
  <div class="playback-bar">

    <!-- 재생 / 일시정지 -->
    <button class="play-btn" @click="playback.toggle" :title="playback.isPlaying ? '일시정지' : '재생'">
      <span v-if="playback.isPlaying">⏸</span>
      <span v-else>▶</span>
    </button>

    <!-- 진행 트랙 -->
    <div class="track" ref="trackRef" @mousedown.prevent="onTrackMouseDown">
      <div class="track-fill" :style="{ width: playback.progress * 100 + '%' }"></div>
      <div class="track-thumb" :style="{ left: playback.progress * 100 + '%' }"></div>
    </div>

    <!-- 프레임 카운터 -->
    <span class="counter">
      {{ padded(playback.currentIndex + 1) }} / {{ padded(playback.totalFrames) }}
    </span>

  </div>
</template>

<style scoped>
.playback-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 20px;
  background: #08121e;
  border-top: 1px solid #1a3a5f;
  flex-shrink: 0;
  user-select: none;
}

/* ── 재생 버튼 ─────────────────────────────────── */
.play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: #1a5fad;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.play-btn:hover  { background: #2478cc; }
.play-btn:active { background: #1248a0; }

/* ── 진행 트랙 ─────────────────────────────────── */
.track {
  flex: 1;
  position: relative;
  height: 4px;
  background: #1a3a6e;
  border-radius: 2px;
  cursor: pointer;
}
.track:hover { background: #1e4a82; }

.track-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #4a9eff;
  border-radius: 2px;
  pointer-events: none;
}

.track-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #88c4ff;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: transform 0.1s;
}
.track:hover .track-thumb { transform: translate(-50%, -50%) scale(1.3); }

/* ── 카운터 ────────────────────────────────────── */
.counter {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #6a9ec8;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  min-width: 72px;
  text-align: right;
}
</style>
