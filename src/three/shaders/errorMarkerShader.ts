/**
 * Error marker: a semi-transparent sphere rendered with rim lighting.
 * Visibility is controlled by the per-instance `errorMarker` attribute (0=off, 1=on),
 * independent of robotStatus.
 *
 * The sphere's translation, instanceScale, and errorMarker attributes are shared
 * buffers from the main robot InstancedGeometry.
 */

export const errorMarkerVertexShader = /* glsl */ `
attribute vec3  translation;
attribute vec3  instanceScale;
attribute float errorMarker;

varying float vIntensity;

void main() {
  float maxScale = max(instanceScale.x, max(instanceScale.y, instanceScale.z));
  vec3 worldPos = position * maxScale * 1.6 + translation;

  // Rim-light intensity: 0 at centre → 1 at silhouette edge
  vec3 vN = normalize(normalMatrix * normal);
  vec3 vE = normalize(vec3(modelViewMatrix * vec4(worldPos, 1.0)));
  vIntensity = 1.0 + dot(vN, vE);

  // Hide instances where errorMarker=0 via w=0 (outside clip space)
  float show = errorMarker > 0.5 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, show);
}
`

export const errorMarkerFragmentShader = /* glsl */ `
uniform float u_time;
varying float vIntensity;

void main() {
  // Pulsing red rim glow
  float pulse = 0.5 + 0.5 * sin(u_time * 6.28318 * 1.5);
  float alpha = pow(vIntensity, 2.0) * pulse;
  gl_FragColor = vec4(1.0, 0.0, 0.0, alpha);
}
`
