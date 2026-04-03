import { defineStore } from 'pinia'
import { ref } from 'vue'

export type AppMode = 'monitoring' | 'editing'

export const useAppStore = defineStore('app', () => {
  const mode = ref<AppMode>('monitoring')
  const containerWidth = ref(800)
  const containerHeight = ref(600)
  const selectedRobotId = ref<number | null>(null)

  function toggleMode() {
    mode.value = mode.value === 'monitoring' ? 'editing' : 'monitoring'
  }

  return { mode, containerWidth, containerHeight, selectedRobotId, toggleMode }
})
