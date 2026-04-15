<script setup lang="ts">
import { watch } from 'vue'
import ThreeMapCanvas   from './components/ThreeMapCanvas.vue'
import ThreeCanvas      from './components/ThreeCanvas.vue'
import KonvaOverlay     from './components/KonvaOverlay.vue'
import RobotPanel       from './components/RobotPanel.vue'
import LabelCanvas      from './components/LabelCanvas.vue'
import DisplayPanel     from './components/DisplayPanel.vue'
import LeftPanel        from './components/LeftPanel.vue'
import TaskDetailPanel  from './components/TaskDetailPanel.vue'
import PlaybackBar      from './components/PlaybackBar.vue'
import { useMapStore }      from './stores/mapStore'
import { usePlaybackStore } from './stores/playbackStore'

const mapStore = useMapStore()
const playback = usePlaybackStore()

// 플레이백 프레임이 바뀔 때마다 robots[0~2] 위치·방향·작업률 갱신
watch(
  () => playback.currentIndex,
  () => {
    const frames = playback.currentFrames
    for (let i = 0; i < 3; i++) {
      const frame = frames[i]
      if (!frame || mapStore.robots.length <= i) continue
      const r = mapStore.robots[i]
      r.x          = frame.x
      r.z          = frame.y
      r.rotationY  = Math.PI / 2 - (frame.angle * Math.PI) / 180
      // 작업률: 현재 경로 인덱스 / 전체 경로 노드 수 - 1
      r.workProgress = Math.round(
        (frame.pathIndex / Math.max(1, frame.path.length - 1)) * 100,
      )
    }
    mapStore.robotVersion++
  },
)
</script>

<template>
  <div class="app-root">
    <div class="viewport">
      <ThreeMapCanvas />
      <KonvaOverlay />
      <ThreeCanvas />
      <LabelCanvas />
      <!-- 좌측 상단: 로봇/태스크 탭 패널 -->
      <LeftPanel />
      <!-- 우측: 세부 모달 (로봇 or 태스크, 상호배타) -->
      <RobotPanel />
      <TaskDetailPanel />
      <!-- 우측 하단: 디스플레이 설정 -->
      <DisplayPanel />
    </div>
    <PlaybackBar />
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #1a1a2e;
}

.viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
