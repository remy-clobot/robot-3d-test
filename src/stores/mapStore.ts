import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  sampleNodes,
  sampleLinks,
  sampleRobots,
  type MapNode,
  type MapLink,
  type Robot,
} from '../data/sampleData'

export interface ProjectedPoint {
  x: number
  y: number
}

export const useMapStore = defineStore('map', () => {
  const nodes  = ref<MapNode[]>([...sampleNodes])
  const links  = ref<MapLink[]>([...sampleLinks])
  const robots = ref<Robot[]>([...sampleRobots])

  // Filled by ThreeCanvas each render frame (raw Map, no reactivity overhead)
  const projectedNodes    = new Map<number, ProjectedPoint>()
  const projectedVersion  = ref(0)   // bump once per frame → KonvaOverlay reacts once

  // Bump this when any robot's status/blink/outline changes → ThreeCanvas re-syncs GPU attrs
  const robotVersion = ref(0)

  function getNode(id: number) {
    return nodes.value.find((n) => n.id === id)
  }

  return { nodes, links, robots, projectedNodes, projectedVersion, robotVersion, getNode }
})
