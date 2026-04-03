import {
  DynamicDrawUsage,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  type BufferGeometry,
} from 'three'

// ─── types ────────────────────────────────────────────────────────────────────

type TypedArrayConstructor = typeof Float32Array | typeof Uint8Array | typeof Int32Array

export interface AttributeDef {
  type: TypedArrayConstructor
  itemSize: number
  normalized?: boolean
}

/** Pass an existing InterleavedBufferAttribute to share a buffer across geometries. */
export type AttributeMap = Record<string, AttributeDef | InterleavedBufferAttribute>

interface UserAttrMeta {
  itemSize: number
  offset: number
  normalized?: boolean
  buffer: InstancedInterleavedBuffer
}

// ─── class ────────────────────────────────────────────────────────────────────

/**
 * InstancedBufferGeometry with a high-level attribute API.
 *
 * - Attributes of the same TypedArray type are packed into a single
 *   interleaved buffer (minimises GPU buffer count).
 * - Passing an existing InterleavedBufferAttribute shares its buffer
 *   with another InstancedGeometry (useful for error-marker spheres that
 *   mirror a robot mesh's translation / status / scale data).
 */
export default class InstancedGeometry extends InstancedBufferGeometry {
  declare userData: {
    attributes: Record<string, UserAttrMeta>
    buffers: InstancedInterleavedBuffer[]
  }

  constructor(geometry: BufferGeometry, count: number, attributes: AttributeMap) {
    super()

    this.instanceCount = 0
    this.userData = { attributes: {}, buffers: [] }

    // Clone base geometry data (positions, normals, uvs, index)
    for (const key of Object.keys(geometry.attributes)) {
      this.attributes[key] = geometry.attributes[key].clone()
    }
    if (geometry.index) {
      this.index = geometry.index.clone()
    }

    // Group attribute definitions by TypedArray type so they share one buffer
    type Group = { type: TypedArrayConstructor; size: number; keys: string[] }
    const groups: Record<string, Group> = {}

    for (const [key, def] of Object.entries(attributes)) {
      if (def instanceof InterleavedBufferAttribute) {
        // Shared reference — set directly, not tracked in userData.attributes
        this.setAttribute(key, def)
      } else {
        const typeName = def.type.name
        const g = (groups[typeName] ??= { type: def.type, size: 0, keys: [] })
        this.userData.attributes[key] = {
          itemSize: def.itemSize,
          offset: g.size,
          normalized: def.normalized,
          buffer: null!, // filled below
        }
        g.size += def.itemSize
        g.keys.push(key)
      }
    }

    // Create one interleaved buffer per type group
    for (const g of Object.values(groups)) {
      const array = new g.type(count * g.size)
      const buffer = new InstancedInterleavedBuffer(array as Float32Array, g.size).setUsage(
        DynamicDrawUsage,
      )

      for (const key of g.keys) {
        const meta = this.userData.attributes[key]
        this.setAttribute(key, new InterleavedBufferAttribute(buffer, meta.itemSize, meta.offset, meta.normalized))
        meta.buffer = buffer
      }
      this.userData.buffers.push(buffer)
    }
  }

  // ─── instance management ───────────────────────────────────────────────────

  addInstance(attributes: Record<string, number | number[]> = {}): void {
    this.setInstanceAttributes(this.instanceCount++, attributes)
  }

  removeInstance(index: number): void {
    const count = this.instanceCount
    for (const buf of this.userData.buffers) {
      const stride = buf.stride
      buf.set(buf.array.subarray((index + 1) * stride, count * stride), index * stride)
      buf.needsUpdate = true
    }
    this.instanceCount--
  }

  setInstanceAttributes(index: number, attributes: Record<string, number | number[]>): void {
    for (const [key, val] of Object.entries(attributes)) {
      const meta = this.userData.attributes[key]
      if (!meta) continue
      const start = index * meta.buffer.stride + meta.offset
      if (Array.isArray(val) || ArrayBuffer.isView(val)) {
        meta.buffer.set(val as number[], start)
      } else {
        meta.buffer.array[start] = val as number
      }
      meta.buffer.needsUpdate = true
    }
  }

  getInstanceAttributes(index: number): Record<string, number | Float32Array> {
    const result: Record<string, number | Float32Array> = {}
    for (const [key, meta] of Object.entries(this.userData.attributes)) {
      const start = index * meta.buffer.stride + meta.offset
      result[key] =
        meta.itemSize > 1
          ? (meta.buffer.array as Float32Array).subarray(start, start + meta.itemSize)
          : meta.buffer.array[start]
    }
    return result
  }

  /** Mark all owned buffers as needing GPU upload. */
  markNeedsUpdate(): void {
    for (const buf of this.userData.buffers) buf.needsUpdate = true
  }
}
