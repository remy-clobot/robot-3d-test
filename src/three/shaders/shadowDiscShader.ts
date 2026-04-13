/**
 * Shadow disc: a flat semi-transparent circle rendered at ground level (y=0.01)
 * beneath each robot. Visibility controlled by the `shadowDisc` attribute (0=off, 1=on).
 *
 * Uses CircleGeometry(1, 48) — vertices lie in XY plane with unit radius.
 * The vertex shader rotates the disc to the XZ ground plane and scales it
 * relative to the robot's instanceScale.
 */

export const shadowDiscVertexShader = /* glsl */ `
attribute vec3  translation;
attribute vec3  instanceScale;
attribute float shadowDisc;

varying vec2 vUv;

void main() {
  // CircleGeometry lies in XY plane (position.z = 0).
  // Rotate to XZ ground plane: (x, y, 0) → (x, 0, -y)
  float radius = max(instanceScale.x, instanceScale.z) * 1.2;
  vec3 worldPos = vec3(
    position.x * radius + translation.x,
    0.01,
    -position.y * radius + translation.z
  );

  // Pass raw unit-circle coords for radial distance in fragment shader
  vUv = position.xy;

  // Hide instances where shadowDisc=0 via w=0 (outside clip space)
  float show = shadowDisc > 0.5 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, show);
}
`

export const shadowDiscFragmentShader = /* glsl */ `
varying vec2 vUv;

void main() {
  float dist = length(vUv);
  // Fade from opaque at center to transparent at edge (60%–100% radius)
  float alpha = 0.35 * (1.0 - smoothstep(0.6, 1.0, dist));
  if (alpha < 0.001) discard;
  gl_FragColor = vec4(0.5, 0.8, 1.0, alpha);
}
`
