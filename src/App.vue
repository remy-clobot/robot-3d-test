<script setup lang="ts">
import ThreeCanvas from './components/ThreeCanvas.vue'
import KonvaOverlay from './components/KonvaOverlay.vue'
import ModeToggle from './components/ModeToggle.vue'
import RobotPanel from './components/RobotPanel.vue'
</script>

<template>
  <div class="app-root">
    <div class="viewport">
      <ThreeCanvas />
      <KonvaOverlay />
      <ModeToggle />
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
