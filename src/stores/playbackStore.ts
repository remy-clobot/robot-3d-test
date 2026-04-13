import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ALL_ROBOT_FRAMES, type RobotFrame } from '../data/robotTrajectoryData'

export const usePlaybackStore = defineStore('playback', () => {
  const currentIndex = ref(0)
  const isPlaying    = ref(false)
  const fps          = ref(10)   // 재생 속도 (프레임/초)

  let timerId: ReturnType<typeof setInterval> | null = null

  // ─── computed ──────────────────────────────────────────────────────────────

  const totalFrames = computed(() =>
    Math.max(...ALL_ROBOT_FRAMES.map((f) => f.length)),
  )

  const progress = computed(() => currentIndex.value / (totalFrames.value - 1))

  /** 각 로봇의 현재 프레임 (인덱스 0~2) */
  const currentFrames = computed<RobotFrame[]>(() =>
    ALL_ROBOT_FRAMES.map((frames) =>
      frames[Math.min(currentIndex.value, frames.length - 1)],
    ),
  )

  /** 각 로봇의 위치 이력: 시작~현재까지의 {x,y} 배열 (인덱스 0~2) */
  const histories = computed<{ x: number; y: number }[][]>(() =>
    ALL_ROBOT_FRAMES.map((frames) =>
      frames
        .slice(0, currentIndex.value + 1)
        .map((f) => ({ x: f.x, y: f.y })),
    ),
  )

  // 하위 호환 (단일 로봇 API)
  const currentFrame = computed<RobotFrame>(() => currentFrames.value[0])
  const history      = computed<{ x: number; y: number }[]>(() => histories.value[0])

  // ─── actions ───────────────────────────────────────────────────────────────

  function tick() {
    if (currentIndex.value < totalFrames.value - 1) {
      currentIndex.value++
    } else {
      pause()
    }
  }

  function play() {
    if (isPlaying.value) return
    if (currentIndex.value >= totalFrames.value - 1) currentIndex.value = 0
    isPlaying.value = true
    timerId = setInterval(tick, 1000 / fps.value)
  }

  function pause() {
    isPlaying.value = false
    if (timerId) { clearInterval(timerId); timerId = null }
  }

  function toggle() {
    isPlaying.value ? pause() : play()
  }

  /** 0~1 범위의 비율로 프레임 이동 */
  function seekByProgress(p: number) {
    currentIndex.value = Math.round(
      Math.max(0, Math.min(1, p)) * (totalFrames.value - 1),
    )
  }

  /** 인덱스로 직접 이동 */
  function seek(index: number) {
    currentIndex.value = Math.max(0, Math.min(totalFrames.value - 1, index))
  }

  return {
    currentIndex, isPlaying, fps,
    totalFrames, progress,
    currentFrames, histories,
    currentFrame, history,
    play, pause, toggle, seek, seekByProgress,
  }
})
