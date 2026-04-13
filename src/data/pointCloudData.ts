/**
 * Point cloud loader from map_data.bin (LiDAR scan data)
 *
 * Binary format:
 *   - Header : first 224,536 bytes (skip)
 *   - Records: 56 bytes each, little-endian float64 fields
 *       +0  confidence (≈ 0.9 for valid scan hits)
 *       +8  x  (map X)
 *       +16 y  (map Y)
 *       +24 z  (= 0, 2D scan)
 *       +32 cos_yaw
 *       +40 sin_yaw
 *       +48 extra
 *
 * 3D coordinate mapping (same as node convention):
 *   record.x → Three.js X
 *   record.y → Three.js Z
 *   Three.js Y = 0  (flat floor scan)
 */

const DATA_START   = 224536
const RECORD_BYTES = 56

export const POINT_HEIGHT_RANGE = { min: -0.1, max: 0.1 }

export async function loadBinPointCloud(): Promise<Float32Array> {
  const response = await fetch('/map_data.bin')
  if (!response.ok) throw new Error(`Failed to fetch map_data.bin: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const view   = new DataView(buffer)

  const pts: number[] = []
  for (let off = DATA_START; off + RECORD_BYTES <= buffer.byteLength; off += RECORD_BYTES) {
    const conf = view.getFloat64(off,      true)
    if (conf < 0.85 || conf > 0.95) continue
    const x = view.getFloat64(off +  8, true)
    const y = view.getFloat64(off + 16, true)
    if (!isFinite(x) || !isFinite(y)) continue
    if (x < -25 || x > 30 || y < -8 || y > 25) continue
    pts.push(x, 0, y)   // Three.js X, Y=0(flat), Z
  }

  console.log(`[pointCloud] loaded ${pts.length / 3} points from map_data.bin`)
  return new Float32Array(pts)
}
