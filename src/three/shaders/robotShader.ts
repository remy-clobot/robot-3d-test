// ─── shared helpers ───────────────────────────────────────────────────────────

/** Rotation matrix helpers (injected into every shader that needs them). */
const rotFns = /* glsl */ `
mat3 rotX(float a) {
  float s = sin(a), c = cos(a);
  return mat3(1.0, 0.0, 0.0,  0.0, c, s,  0.0, -s, c);
}
mat3 rotY(float a) {
  float s = sin(a), c = cos(a);
  return mat3(c, 0.0, -s,  0.0, 1.0, 0.0,  s, 0.0, c);
}
mat3 rotZ(float a) {
  float s = sin(a), c = cos(a);
  return mat3(c, s, 0.0,  -s, c, 0.0,  0.0, 0.0, 1.0);
}
`

/**
 * Per-instance attributes & varyings used in all robot shaders.
 * Standalone shaders (outline, picking) embed this directly in their source.
 * The main material uses onBeforeCompile to inject it after #include <common>.
 */
const instanceDeclarations = /* glsl */ `
uniform float u_time;

attribute vec3  translation;
attribute float rotationX;
attribute float rotationY;
attribute float rotationZ;
attribute float opacity0;
attribute float robotStatus;   // 0 = normal | 1 = warning | 2 = error
attribute float blink;         // 0 = off    | 1 = on  (independent of status)
attribute float outline;       // 0 = off    | 1 = on  (independent of selection)
attribute vec3  instanceScale;
attribute vec3  idColor;       // picking color (meshTypeIdx/255, hi/255, lo/255)

varying vec3  vInstanceColor;
varying float vInstanceOpacity;

${rotFns}
`

// ─── vertex position transformation ──────────────────────────────────────────
//
// Used verbatim in both onBeforeCompile injection and standalone shaders.
// Preprocessor defines OUTLINE / PICKING inflate the model for BackSide tricks.

const transformPosition = /* glsl */ `
vec3 localPos = position * instanceScale;

#ifdef OUTLINE
localPos += sign(localPos) * 0.08;
#endif

#ifdef PICKING
localPos += sign(localPos) * 0.3;
#endif

vec3 transformed = rotZ(rotationZ) * rotY(rotationY) * rotX(rotationX) * localPos + translation;
`

// ─── color / opacity assignment (main mesh only) ──────────────────────────────

const colorVertex = /* glsl */ `
#include <color_vertex>

if      (robotStatus < 0.5) vInstanceColor = vec3(0.18, 0.80, 0.44); // normal  → green
else if (robotStatus < 1.5) vInstanceColor = vec3(1.00, 0.60, 0.00); // warning → orange
else if (robotStatus < 2.5) vInstanceColor = vec3(0.90, 0.20, 0.20); // error   → red
else                        vInstanceColor = vec3(0.50, 0.50, 0.50); // deactive → gray

if (blink > 0.5) {
  // 1.5 Hz smooth sine blink: fully visible ↔ nearly transparent
  float phase = 0.5 + 0.5 * sin(u_time * 6.28318 * 1.5);
  vInstanceOpacity = mix(0.15, 1.0, phase);
} else {
  vInstanceOpacity = opacity0;
}
`

// ─── injection helpers for MeshLambertMaterial.onBeforeCompile ───────────────

export function injectRobotVertex(shader: string): string {
  return shader
    .replace('#include <common>', `#include <common>\n${instanceDeclarations}`)
    .replace('#include <begin_vertex>', transformPosition)
    .replace('#include <color_vertex>', colorVertex)
}

export function injectRobotFragment(shader: string): string {
  // Three.js 0.160+ removed #include <packing> from MeshLambertMaterial fragment.
  // Use #include <common> (always present) as the injection anchor.
  return shader
    .replace(
      '#include <common>',
      `#include <common>
varying vec3  vInstanceColor;
varying float vInstanceOpacity;`,
    )
    .replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      'vec4 diffuseColor = vec4( diffuse * vInstanceColor, vInstanceOpacity );',
    )
}

// ─── Outline shader (pure ShaderMaterial, BackSide) ──────────────────────────
//
// The model is slightly inflated (#define OUTLINE) and only the back faces are
// drawn, creating a halo effect. gl_Position.w = 0 discards instances where
// outline == 0 (w=0 places the vertex at infinity → outside clip space).

export const outlineVertexShader = /* glsl */ `
#define OUTLINE
${instanceDeclarations}

void main() {
  ${transformPosition}
  float show = outline > 0.5 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, show);
}
`

export const outlineFragmentShader = /* glsl */ `
uniform float u_time;  // unused here, present for uniform block consistency

void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`

// ─── Picking shader (color-buffer picking) ────────────────────────────────────

export const pickingVertexShader = /* glsl */ `
#define PICKING
${instanceDeclarations}
varying vec3 vIdColor;

void main() {
  ${transformPosition}
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  vIdColor = idColor;
}
`

export const pickingFragmentShader = /* glsl */ `
varying vec3 vIdColor;

void main() {
  gl_FragColor = vec4(vIdColor, 1.0);
}
`
