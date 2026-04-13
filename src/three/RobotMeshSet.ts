import * as THREE from 'three'
import InstancedGeometry from './geometry/InstancedGeometry'
import { InterleavedBufferAttribute } from 'three'
import {
  injectRobotVertex,
  injectRobotFragment,
  outlineVertexShader,
  outlineFragmentShader,
  pickingVertexShader,
  pickingFragmentShader,
} from './shaders/robotShader'
import { errorMarkerVertexShader, errorMarkerFragmentShader } from './shaders/errorMarkerShader'
import { shadowDiscVertexShader, shadowDiscFragmentShader } from './shaders/shadowDiscShader'

// ─── public types ─────────────────────────────────────────────────────────────

export interface RobotInstanceAttrs {
  /** World-space position [x, y, z] */
  translation?: [number, number, number]
  rotationX?: number
  rotationY?: number
  rotationZ?: number
  /** Base opacity (overridden by blink when blink=1) */
  opacity0?: number
  /** 0=normal  1=warning  2=error */
  robotStatus?: number
  /** 0=off  1=on — blink effect, independent of status */
  blink?: number
  /** 0=off  1=on — outline halo, independent of selection */
  outline?: number
  /** 0=off  1=on — error marker sphere, independent of status */
  errorMarker?: number
  /** 0=off  1=on — shadow disc on ground plane */
  shadowDisc?: number
  /** Per-robot scale [w, h, d] */
  instanceScale?: [number, number, number]
}

export interface RobotMeshSetOptions {
  maxCount?: number
  /** Index used to encode this mesh set in the picking color (R channel). */
  meshTypeIndex?: number
  /** Create a picking mesh for color-buffer picking. Default: false. */
  enablePicking?: boolean
  /** Create a rim-lit sphere for error-state robots. Default: true. */
  enableErrorMarker?: boolean
  /** Create a shadow disc on the ground plane. Default: true. */
  enableShadowDisc?: boolean
  /** Pre-sized outline geometry (slightly larger than base). Avoids shader inflation artifacts. */
  outlineGeometry?: THREE.BufferGeometry
}

// ─── defaults ─────────────────────────────────────────────────────────────────

const ATTR_DEFAULTS: Required<RobotInstanceAttrs> = {
  translation: [0, 0, 0],
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  opacity0: 1.0,
  robotStatus: 0,
  blink: 0,
  outline: 0,
  errorMarker: 0,
  shadowDisc: 0,
  instanceScale: [1, 1, 1],
}

// ─── class ────────────────────────────────────────────────────────────────────

/**
 * Unified instanced-mesh set for any robot geometry.
 *
 * Replaces the inheritance chain (BaseRobotMeshSet / GuideRobotMeshSet /
 * SquareRobotMeshSet) with a single class that accepts the geometry from
 * outside (factory or caller) and builds all sub-meshes internally.
 *
 * Sub-meshes:
 *   mesh           — main robot body (MeshLambertMaterial + shader injection)
 *   outlineMesh    — back-face inflate halo (ShaderMaterial, BackSide)
 *   pickingMesh?   — color-buffer picking (optional)
 *   errorMarkerMesh? — rim-lit sphere for error state (optional)
 */
export class RobotMeshSet {
  // Uniforms shared across all sub-materials of this set
  readonly uniforms: { u_time: { value: number } } = { u_time: { value: 0 } }

  readonly geometry: InstancedGeometry
  readonly mesh: THREE.Mesh
  private readonly material: THREE.MeshLambertMaterial

  readonly outlineMesh: THREE.Mesh
  private readonly outlineMaterial: THREE.ShaderMaterial
  private readonly outlineInstancedGeometry: InstancedGeometry

  readonly pickingMesh?: THREE.Mesh
  private readonly pickingMaterial?: THREE.ShaderMaterial

  private errorMarkerGeometry?: InstancedGeometry
  private errorMarkerMaterial?: THREE.ShaderMaterial
  readonly errorMarkerMesh?: THREE.Mesh

  private shadowDiscGeometry?: InstancedGeometry
  private shadowDiscMaterial?: THREE.ShaderMaterial
  readonly shadowDiscMesh?: THREE.Mesh

  private readonly meshTypeIndex: number
  private readonly maxCount: number

  constructor(
    baseGeometry: THREE.BufferGeometry,
    {
      maxCount = 500,
      meshTypeIndex = 0,
      enablePicking = false,
      enableErrorMarker = true,
      enableShadowDisc = true,
      outlineGeometry,
    }: RobotMeshSetOptions = {},
  ) {
    this.meshTypeIndex = meshTypeIndex
    this.maxCount = maxCount //test

    // ── InstancedGeometry ──────────────────────────────────────────────────
    this.geometry = new InstancedGeometry(baseGeometry, maxCount, {
      translation:   { type: Float32Array, itemSize: 3 },
      rotationX:     { type: Float32Array, itemSize: 1 },
      rotationY:     { type: Float32Array, itemSize: 1 },
      rotationZ:     { type: Float32Array, itemSize: 1 },
      opacity0:      { type: Float32Array, itemSize: 1 },
      robotStatus:   { type: Float32Array, itemSize: 1 },
      blink:         { type: Float32Array, itemSize: 1 },
      outline:       { type: Float32Array, itemSize: 1 },
      errorMarker:   { type: Float32Array, itemSize: 1 },
      shadowDisc:    { type: Float32Array, itemSize: 1 },
      instanceScale: { type: Float32Array, itemSize: 3 },
      idColor:       { type: Float32Array, itemSize: 3 },
    })

    // Safe to dispose the source geometry — InstancedGeometry cloned its data
    baseGeometry.dispose()

    // ── Main mesh ──────────────────────────────────────────────────────────
    this.material = new THREE.MeshLambertMaterial({ transparent: true,/* depthWrite: true*/ })
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)
      shader.vertexShader = injectRobotVertex(shader.vertexShader)
      shader.fragmentShader = injectRobotFragment(shader.fragmentShader)
    }
    this.mesh = this._makeMesh(this.geometry, this.material, 1)

    // ── Outline mesh ───────────────────────────────────────────────────────
    // Use a pre-sized geometry (slightly larger than base) so no per-vertex
    // shader inflation is needed — avoids gaps on Cylinder curved surfaces
    // and over-expansion at Box corners.
    const outlineBase = outlineGeometry ?? baseGeometry
    this.outlineInstancedGeometry = new InstancedGeometry(outlineBase, maxCount, {
      translation:   this.geometry.getAttribute('translation')   as InterleavedBufferAttribute,
      rotationX:     this.geometry.getAttribute('rotationX')     as InterleavedBufferAttribute,
      rotationY:     this.geometry.getAttribute('rotationY')     as InterleavedBufferAttribute,
      rotationZ:     this.geometry.getAttribute('rotationZ')     as InterleavedBufferAttribute,
      instanceScale: this.geometry.getAttribute('instanceScale') as InterleavedBufferAttribute,
      outline:       this.geometry.getAttribute('outline')       as InterleavedBufferAttribute,
    })
    if (outlineGeometry) outlineGeometry.dispose()

    this.outlineMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: outlineVertexShader,
      fragmentShader: outlineFragmentShader,
      side: THREE.BackSide,
    })
    this.outlineMesh = this._makeMesh(this.outlineInstancedGeometry, this.outlineMaterial, 1)

    // ── Picking mesh (optional) ────────────────────────────────────────────
    if (enablePicking) {
      this.pickingMaterial = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: pickingVertexShader,
        fragmentShader: pickingFragmentShader,
      })
      ;(this as any).pickingMesh = this._makeMesh(this.geometry, this.pickingMaterial, 0)
    }

    // ── Error marker (optional) ────────────────────────────────────────────
    if (enableErrorMarker) {
      this._initErrorMarker()
    }

    // ── Shadow disc (optional) ─────────────────────────────────────────────
    if (enableShadowDisc) {

      this._initShadowDisc()
    }
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private _makeMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    renderOrder: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.matrixAutoUpdate = false
    mesh.frustumCulled = false
    mesh.renderOrder = renderOrder
    return mesh
  }

  private _initErrorMarker(): void {
    // The sphere shares translation, errorMarker, scale buffers with the main
    // geometry so it always reflects the latest robot state.
    const sphere = new THREE.SphereGeometry(0.8, 18, 18)
    this.errorMarkerGeometry = new InstancedGeometry(sphere, this.maxCount, {
      translation:   this.geometry.getAttribute('translation') as any,
      errorMarker:   this.geometry.getAttribute('errorMarker') as any,
      instanceScale: this.geometry.getAttribute('instanceScale') as any,
    })
    sphere.dispose()

    this.errorMarkerMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: errorMarkerVertexShader,
      fragmentShader: errorMarkerFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    ;(this as any).errorMarkerMesh = this._makeMesh(this.errorMarkerGeometry, this.errorMarkerMaterial, 2)
  }

  private _initShadowDisc(): void {
    // CircleGeometry(1, 48): radius=1 so position.xy is directly in unit-circle space [-1,1]
    const circle = new THREE.CircleGeometry(1, 48)
    this.shadowDiscGeometry = new InstancedGeometry(circle, this.maxCount, {
      translation:   this.geometry.getAttribute('translation') as any,
      instanceScale: this.geometry.getAttribute('instanceScale') as any,
      shadowDisc:    this.geometry.getAttribute('shadowDisc') as any,
    })
    circle.dispose()

    this.shadowDiscMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: shadowDiscVertexShader,
      fragmentShader: shadowDiscFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    ;(this as any).shadowDiscMesh = this._makeMesh(this.shadowDiscGeometry, this.shadowDiscMaterial, -1)
  }

  // ─── public API ────────────────────────────────────────────────────────────

  get instanceCount(): number {
    return this.geometry.instanceCount
  }

  /**
   * Add one robot instance.
   * idColor is auto-computed from meshTypeIndex + instance index.
   */
  addInstance(attrs: RobotInstanceAttrs = {}): void {
    const idx = this.geometry.instanceCount
    const idColor: [number, number, number] = [
      this.meshTypeIndex / 255,
      ((idx >> 8) & 0xff) / 255,
      (idx & 0xff) / 255,
    ]
    this.geometry.addInstance({ ...ATTR_DEFAULTS, ...attrs, idColor })
    // sub-geometries share attribute buffers; only instanceCount needs incrementing
    this.outlineInstancedGeometry.addInstance()
    this.errorMarkerGeometry?.addInstance()
    this.shadowDiscGeometry?.addInstance()
  }

  /** Update arbitrary attributes for a single instance by index. */
  setInstanceAttrs(index: number, attrs: Partial<RobotInstanceAttrs>): void {
    this.geometry.setInstanceAttributes(index, attrs as Record<string, any>)
  }

  /** Update the u_time uniform (drives blink & error-marker pulse). */
  tickTime(seconds: number): void {
    this.uniforms.u_time.value = seconds
  }

  /** Add all sub-meshes to a Three.js scene. */
  addToScene(scene: THREE.Scene, pickingScene?: THREE.Scene): void {
    if (this.shadowDiscMesh) scene.add(this.shadowDiscMesh)  // renderOrder=-1
    scene.add(this.outlineMesh)
    scene.add(this.mesh)
    if (this.errorMarkerMesh) scene.add(this.errorMarkerMesh)
    if (this.pickingMesh && pickingScene) pickingScene.add(this.pickingMesh)
  }

  /** Remove all sub-meshes from their parent scenes. */
  removeFromScene(): void {
    this.shadowDiscMesh?.removeFromParent()
    this.outlineMesh.removeFromParent()
    this.mesh.removeFromParent()
    this.errorMarkerMesh?.removeFromParent()
    this.pickingMesh?.removeFromParent()
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.outlineInstancedGeometry.dispose()
    this.outlineMaterial.dispose()
    this.pickingMaterial?.dispose()
    this.errorMarkerGeometry?.dispose()
    this.errorMarkerMaterial?.dispose()
    this.shadowDiscGeometry?.dispose()
    this.shadowDiscMaterial?.dispose()
  }
}
