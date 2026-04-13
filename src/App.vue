<script setup lang="ts">
import ThreeMapCanvas from './components/ThreeMapCanvas.vue'
import ThreeCanvas from './components/ThreeCanvas.vue'
import KonvaOverlay from './components/KonvaOverlay.vue'
import ModeToggle from './components/ModeToggle.vue'
import RobotPanel from './components/RobotPanel.vue'
import LabelCanvas from './components/LabelCanvas.vue'
import DisplayPanel from './components/DisplayPanel.vue'
</script>

<template>
  <div class="app-root">
    <div class="viewport">
      <ThreeMapCanvas />
      <KonvaOverlay />

      <ThreeCanvas />
      <LabelCanvas />
      <ModeToggle />
      <DisplayPanel />
      <RobotPanel />
    </div>
  </div>
</template>

<style scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #1a1a2e;
}

.viewport {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
