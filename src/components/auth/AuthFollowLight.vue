<template>
  <div ref="layersRef" class="auth-light-layers" aria-hidden="true">
    <div class="surface-darkness"></div>
  </div>
  <canvas ref="canvasRef" class="webgl-canvas" aria-hidden="true"></canvas>
  <div ref="fallbackRef" class="fallback-lamp" aria-hidden="true">
    <span class="lamp-adapter"></span>
    <span class="lamp-joint"></span>
    <span class="lamp-barrel"></span>
    <span class="lamp-heat-ring lamp-heat-ring--one"></span>
    <span class="lamp-heat-ring lamp-heat-ring--two"></span>
    <span class="lamp-bezel"></span>
    <span class="lamp-lens"></span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import {
  advanceFollower,
  clampTrackTarget,
  isStaticLightMode,
  resolveDefaultLampX,
  type FollowState,
} from './authFollowLightMotion'
import { loginBeamTransitionState, recordAuthLightSnapshot } from './loginBeamTransition'

const layersRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fallbackRef = ref<HTMLElement | null>(null)

const pointerTarget = { x: 0, y: 0 }
const lightState = { x: 0, y: 0 }
let lampState: FollowState = { position: 0, velocity: 0 }
let headAngle = 0
let animationFrame = 0
let lastTime = 0
let lampScreenY = 86
let threeReady = false
let desktopFollow: MediaQueryList | null = null
let reduceMotion: MediaQueryList | null = null
let renderer: THREE.WebGLRenderer | null = null
let camera: THREE.OrthographicCamera | null = null
let scene: THREE.Scene | null = null
let lightScene: THREE.Scene | null = null
let lampRoot: THREE.Group | null = null
let receiverPlane: THREE.Mesh | null = null
let spotLight: THREE.SpotLight | null = null
let spotTarget: THREE.Object3D | null = null
let lampY = 0
let lampModelScreenScale = 88 / 92.4

const REFERENCE_WORLD_SCALE = 0.01
const LIGHT_RECEIVER_Z = 0
const LIGHT_SOURCE_Z = 1.18
const TRACK_LAMP_SCREEN_WIDTH = 88
const TRACK_LAMP_MODEL_WIDTH = 92.4
const TRACK_LAMP_MOBILE_SCALE = 0.78
const TRACK_LENS_LOCAL_Y = -38.5
const geometries: THREE.BufferGeometry[] = []
const materials: THREE.Material[] = []
const textures: THREE.Texture[] = []

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function isStaticMode() {
  return isStaticLightMode(window.innerWidth, reduceMotion?.matches ?? false)
}

function formTarget() {
  const card = layersRef.value?.parentElement?.querySelector<HTMLElement>('.auth-card')
  if (!card) {
    return {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.55,
      right: window.innerWidth - 16,
    }
  }
  const rect = card.getBoundingClientRect()
  return {
    x: rect.left + rect.width * 0.5,
    y: clamp(rect.top + rect.height * 0.5, window.innerHeight * 0.26, window.innerHeight * 0.76),
    right: rect.right,
  }
}

function defaultTarget() {
  const form = formTarget()
  if (isStaticMode()) {
    return {
      lampX: resolveDefaultLampX(form.x, form.right, window.innerWidth),
      lightX: form.x,
      lightY: form.y,
    }
  }
  const offset = Math.min(150, window.innerWidth * 0.1)
  return {
    lampX: clampTrackTarget(form.x - offset, window.innerWidth),
    lightX: form.x,
    lightY: form.y,
  }
}

function applyLighting(screenX: number, screenY: number) {
  const layers = layersRef.value
  if (!layers) return
  layers.style.setProperty('--light-x', `${screenX}px`)
  layers.style.setProperty('--light-y', `${screenY}px`)
}

function setLampPose(screenX: number, angle: number) {
  if (fallbackRef.value) {
    fallbackRef.value.style.left = `${screenX}px`
    fallbackRef.value.style.top = `${lampScreenY}px`
    fallbackRef.value.style.setProperty('--lamp-angle', `${angle}rad`)
  }
  if (!lampRoot) return
  const lampWorldX = (screenX - window.innerWidth / 2) * REFERENCE_WORLD_SCALE
  lampRoot.position.set(lampWorldX, lampY * REFERENCE_WORLD_SCALE, 0)
  lampRoot.rotation.z = angle

  if (spotLight && spotTarget) {
    spotLight.position.set(
      lampWorldX,
      (lampY + TRACK_LENS_LOCAL_Y * lampModelScreenScale) * REFERENCE_WORLD_SCALE,
      LIGHT_SOURCE_Z,
    )
    spotTarget.position.set(
      (lightState.x - window.innerWidth / 2) * REFERENCE_WORLD_SCALE,
      (window.innerHeight / 2 - lightState.y) * REFERENCE_WORLD_SCALE,
      LIGHT_RECEIVER_Z,
    )
    spotTarget.updateMatrixWorld()
  }
}

function publishTransitionSnapshot() {
  recordAuthLightSnapshot({
    lampX: lampState.position,
    lampY: lampScreenY,
    lightX: lightState.x,
    lightY: lightState.y,
    lampAngle: headAngle,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  })
}

function renderThree() {
  if (!renderer || !scene || !lightScene || !camera) return
  renderer.clear()
  renderer.render(lightScene, camera)
  renderer.clearDepth()
  renderer.render(scene, camera)
}

function updateLampMetrics() {
  const mobile = window.innerWidth <= 760
  lampScreenY = mobile ? 58 : Math.min(96, Math.max(76, window.innerHeight * 0.1))
  lampY = window.innerHeight / 2 - lampScreenY
  lampModelScreenScale =
    TRACK_LAMP_SCREEN_WIDTH / TRACK_LAMP_MODEL_WIDTH *
    (mobile ? TRACK_LAMP_MOBILE_SCALE : 1)
  lampRoot?.scale.setScalar(lampModelScreenScale * REFERENCE_WORLD_SCALE)
}

function resizeThree() {
  updateLampMetrics()
  if (!renderer || !camera) return
  const width = Math.max(1, window.innerWidth)
  const height = Math.max(1, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 760 ? 1.25 : 1.6))
  renderer.setSize(width, height, false)
  camera.left = -width * REFERENCE_WORLD_SCALE / 2
  camera.right = width * REFERENCE_WORLD_SCALE / 2
  camera.top = height * REFERENCE_WORLD_SCALE / 2
  camera.bottom = -height * REFERENCE_WORLD_SCALE / 2
  camera.updateProjectionMatrix()
  receiverPlane?.scale.set(width * REFERENCE_WORLD_SCALE, height * REFERENCE_WORLD_SCALE, 1)
}

function applyStaticState() {
  const target = defaultTarget()
  pointerTarget.x = target.lightX
  pointerTarget.y = target.lightY
  lightState.x = target.lightX
  lightState.y = target.lightY
  lampState = { position: target.lampX, velocity: 0 }
  headAngle = 0
  applyLighting(target.lightX, target.lightY)
  setLampPose(target.lampX, 0)
  publishTransitionSnapshot()
  renderThree()
}

function animate(time: number) {
  animationFrame = 0
  if (loginBeamTransitionState.active) return
  if (isStaticMode()) {
    applyStaticState()
    return
  }

  const dt = Math.min(0.035, Math.max(0.001, (time - lastTime) / 1000))
  lastTime = time
  const trackTarget = clampTrackTarget(pointerTarget.x, window.innerWidth)
  lampState = advanceFollower(lampState, trackTarget, dt)

  const lightEase = 1 - Math.exp(-6.5 * dt)
  lightState.x += (pointerTarget.x - lightState.x) * lightEase
  lightState.y += (pointerTarget.y - lightState.y) * lightEase

  const desiredAngle = clamp(
    Math.atan2(lightState.x - lampState.position, Math.max(180, lightState.y - lampScreenY)) * 0.36,
    -0.12,
    0.12,
  )
  headAngle += (desiredAngle - headAngle) * (1 - Math.exp(-9 * dt))

  applyLighting(lightState.x, lightState.y)
  setLampPose(lampState.position, headAngle)
  publishTransitionSnapshot()
  renderThree()

  const lampError = Math.abs(trackTarget - lampState.position)
  const lightError = Math.hypot(pointerTarget.x - lightState.x, pointerTarget.y - lightState.y)
  if (
    lampError > 0.15 ||
    Math.abs(lampState.velocity) > 0.15 ||
    lightError > 0.2 ||
    Math.abs(desiredAngle - headAngle) > 0.0005
  ) {
    animationFrame = requestAnimationFrame(animate)
  }
}

function startAnimation() {
  if (loginBeamTransitionState.active) return
  if (!threeReady || isStaticMode() || animationFrame) return
  lastTime = performance.now()
  animationFrame = requestAnimationFrame(animate)
}

function handlePointerMove(event: PointerEvent) {
  if (isStaticMode()) return
  pointerTarget.x = event.clientX
  pointerTarget.y = event.clientY
  startAnimation()
}

function handlePointerLeave() {
  const target = defaultTarget()
  pointerTarget.x = target.lightX
  pointerTarget.y = target.lightY
  startAnimation()
}

function handleModeChange() {
  if (loginBeamTransitionState.active) return
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
  }
  resizeThree()
  applyStaticState()
}

function createGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
  geometries.push(geometry)
  return geometry
}

function createMaterial<T extends THREE.Material>(material: T): T {
  materials.push(material)
  return material
}

function initThree() {
  const canvas = canvasRef.value
  if (!canvas) return

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setClearColor(0x000000, 0)
  renderer.autoClear = false

  scene = new THREE.Scene()
  lightScene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20)
  camera.position.set(0, 0, 6)
  camera.lookAt(0, 0, 0)

  const lightReceiver = new THREE.Mesh(
    createGeometry(new THREE.PlaneGeometry(1, 1)),
    createMaterial(new THREE.MeshStandardMaterial({
      color: 0xc5cad4,
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })),
  )
  lightReceiver.position.z = LIGHT_RECEIVER_Z
  receiverPlane = lightReceiver
  lightScene.add(lightReceiver)

  scene.add(new THREE.HemisphereLight(0x8392ac, 0x151118, 1.15))
  const fill = new THREE.DirectionalLight(0x93a8c9, 1.5)
  fill.position.set(-260, 320, 500)
  scene.add(fill)

  lampRoot = new THREE.Group()
  scene.add(lampRoot)

  const darkMetal = createMaterial(new THREE.MeshStandardMaterial({
    color: 0x11151a,
    roughness: 0.34,
    metalness: 0.82,
  }))
  const bodyMetal = createMaterial(new THREE.MeshStandardMaterial({
    color: 0x252b31,
    roughness: 0.3,
    metalness: 0.78,
  }))

  const adapter = new THREE.Mesh(
    createGeometry(new THREE.BoxGeometry(54, 14, 30)),
    darkMetal,
  )
  adapter.position.y = 18
  lampRoot.add(adapter)

  const joint = new THREE.Mesh(
    createGeometry(new THREE.CylinderGeometry(7, 8, 18, 24)),
    darkMetal,
  )
  joint.position.y = 5
  lampRoot.add(joint)

  const barrel = new THREE.Mesh(
    createGeometry(new THREE.CylinderGeometry(37, 41, 44, 48)),
    bodyMetal,
  )
  barrel.position.y = -17
  lampRoot.add(barrel)

  for (const [index, y] of [-1, -10].entries()) {
    const heatRing = new THREE.Mesh(
      createGeometry(new THREE.TorusGeometry(38.5, 1.25, 8, 48)),
      darkMetal,
    )
    heatRing.name = `lamp-heat-ring-${index + 1}`
    heatRing.rotation.x = Math.PI / 2
    heatRing.position.y = y
    lampRoot.add(heatRing)
  }

  const bezel = new THREE.Mesh(
    createGeometry(new THREE.TorusGeometry(42, 4.2, 12, 64)),
    darkMetal,
  )
  bezel.rotation.x = Math.PI / 2
  bezel.position.y = -39
  lampRoot.add(bezel)

  const lensMaterial = createMaterial(new THREE.MeshStandardMaterial({
    color: 0x332217,
    emissive: 0xffb36b,
    emissiveIntensity: 0.58,
    roughness: 0.82,
    side: THREE.DoubleSide,
  }))
  const lens = new THREE.Mesh(
    createGeometry(new THREE.CircleGeometry(36, 64)),
    lensMaterial,
  )
  lens.rotation.x = Math.PI / 2
  lens.position.y = TRACK_LENS_LOCAL_Y
  lampRoot.add(lens)

  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = glowCanvas.height = 96
  const context = glowCanvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.16, 'rgba(255,222,172,.82)')
    gradient.addColorStop(0.46, 'rgba(255,170,94,.22)')
    gradient.addColorStop(1, 'rgba(255,140,70,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 96, 96)
  }
  const glowTexture = new THREE.CanvasTexture(glowCanvas)
  textures.push(glowTexture)
  const glow = new THREE.Sprite(createMaterial(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffb36b,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })))
  glow.position.y = -39
  glow.scale.set(58, 58, 58)
  lampRoot.add(glow)

  const bulbLight = new THREE.PointLight(0xffb36b, 1, 270, 2)
  bulbLight.power = 42
  bulbLight.position.set(0, -39, 18)
  lampRoot.add(bulbLight)

  spotLight = new THREE.SpotLight(
    0xffb36b,
    1,
    18,
    THREE.MathUtils.degToRad(34),
    0.88,
    2,
  )
  spotLight.power = 1450
  spotTarget = new THREE.Object3D()
  spotLight.target = spotTarget
  lightScene.add(spotLight, spotTarget)

  resizeThree()
  applyStaticState()
  threeReady = true
  canvas.classList.add('three-ready')
}

function disposeThree() {
  geometries.splice(0).forEach(geometry => geometry.dispose())
  materials.splice(0).forEach(material => material.dispose())
  textures.splice(0).forEach(texture => texture.dispose())
  if (renderer) renderer.dispose()
  renderer = null
  camera = null
  scene = null
  lightScene = null
  lampRoot = null
  receiverPlane = null
  spotLight = null
  spotTarget = null
  threeReady = false
}

onMounted(() => {
  desktopFollow = matchMedia('(min-width: 761px)')
  reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
  desktopFollow.addEventListener('change', handleModeChange)
  reduceMotion.addEventListener('change', handleModeChange)
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('resize', handleModeChange, { passive: true })
  document.documentElement.addEventListener('mouseleave', handlePointerLeave)

  updateLampMetrics()
  applyStaticState()
  try {
    initThree()
  } catch (error) {
    console.error('Auth follow light failed to initialize.', error)
    applyStaticState()
  }
})

onBeforeUnmount(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('resize', handleModeChange)
  document.documentElement.removeEventListener('mouseleave', handlePointerLeave)
  desktopFollow?.removeEventListener('change', handleModeChange)
  reduceMotion?.removeEventListener('change', handleModeChange)
  disposeThree()
})
</script>

<style scoped>
.auth-light-layers {
  --lamp-rgb: 255, 179, 107;
  --light-x: 50vw;
  --light-y: 54vh;
  --peripheral-dim: .48;
  --spot-rx: 310px;
  --spot-ry: 245px;
  position: fixed;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  pointer-events: none;
}

.surface-darkness {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.surface-darkness {
  background: rgba(0, 0, 0, var(--peripheral-dim));
  -webkit-mask-image: radial-gradient(
    ellipse var(--spot-rx) var(--spot-ry) at var(--light-x) var(--light-y),
    transparent 0%,
    rgba(0, 0, 0, .16) 42%,
    #000 100%
  );
  mask-image: radial-gradient(
    ellipse var(--spot-rx) var(--spot-ry) at var(--light-x) var(--light-y),
    transparent 0%,
    rgba(0, 0, 0, .16) 42%,
    #000 100%
  );
  transition: opacity 180ms ease;
}

.webgl-canvas {
  position: fixed;
  inset: 0;
  z-index: 3;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.fallback-lamp {
  --lamp-angle: 0rad;
  --lamp-model-scale: 1;
  --lamp-rgb: 255, 179, 107;
  position: fixed;
  top: 0;
  left: 50vw;
  z-index: 3;
  width: 88px;
  height: 112px;
  transform: translate(-50%, -35%) rotate(var(--lamp-angle)) scale(var(--lamp-model-scale));
  transform-origin: 50% 35%;
  pointer-events: none;
}

.fallback-lamp > span {
  position: absolute;
}

.lamp-adapter {
  top: 15.4px;
  left: 18.3px;
  width: 51.4px;
  height: 13.3px;
  border-radius: 4px;
  background: linear-gradient(90deg, #080b0f, #343a41 48%, #0d1014);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.1), 0 6px 10px rgba(0, 0, 0, 0.3);
}

.lamp-joint {
  top: 25.9px;
  left: 36.4px;
  width: 15.2px;
  height: 17.1px;
  border-radius: 5px;
  background: linear-gradient(90deg, #0d1116, #5d646b 50%, #11161c);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.1);
}

.lamp-barrel {
  top: 34.4px;
  left: 5px;
  width: 78.1px;
  height: 41.9px;
  border-radius: 18px 18px 24px 24px / 10px 10px 15px 15px;
  background: linear-gradient(90deg, #07090c, #252b31 28%, #50575e 48%, #1a1f25 70%, #07090c);
  box-shadow: inset 0 2px rgba(255, 255, 255, 0.1), 0 14px 24px rgba(0, 0, 0, 0.38);
}

.lamp-heat-ring {
  left: 6.1px;
  z-index: 1;
  width: 75.7px;
  height: 2.4px;
  border-radius: 50%;
  background: linear-gradient(90deg, #0b0e12, #4b5259 46%, #11161b);
  box-shadow: 0 1px rgba(255, 255, 255, 0.06), 0 2px 3px rgba(0, 0, 0, 0.45);
}

.lamp-heat-ring--one {
  top: 39px;
}

.lamp-heat-ring--two {
  top: 47.5px;
}

.lamp-bezel {
  top: 72.3px;
  left: 0;
  z-index: 2;
  width: 88px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(90deg, #07090c, #252a30 46%, #080a0d);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.09), 0 5px 10px rgba(0, 0, 0, 0.42);
}

.lamp-lens {
  top: 71.1px;
  left: 9.7px;
  z-index: 3;
  width: 68.6px;
  height: 9.5px;
  border-radius: 50%;
  background: radial-gradient(ellipse, #fff9e9 0 18%, #ffc77e 31%, #6a472f 53%, #07090c 72%);
  box-shadow: 0 0 22px rgba(var(--lamp-rgb), 0.56), inset 0 0 8px rgba(0, 0, 0, 0.62);
}

.webgl-canvas.three-ready + .fallback-lamp {
  display: none;
}

@media (max-width: 760px) {
  .auth-light-layers {
    --spot-rx: 310px;
    --spot-ry: 245px;
  }

  .webgl-canvas,
  .fallback-lamp {
    z-index: 3;
  }

  .fallback-lamp {
    --lamp-model-scale: 0.78;
  }
}
</style>
