<template>
  <div class="three-layout-shell">
    <button class="view-toggle-btn" type="button" @click.stop="toggleCameraView">
      {{ cameraViewMode === 'display' ? '调节射灯视角' : '展示视角' }}
    </button>
    <div ref="viewportRef" class="three-layout-viewport"></div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type LampTemperature = 3000 | 4000 | 6000

type LampLayout = {
  id: string
  name: string
  x: number
  brightness: number
  temperature: LampTemperature
  clothingColor: string
  targetX: number
}

type TrackHandle = 'left' | 'right'
type CameraViewMode = 'display' | 'adjust'

type CameraViewPreset = {
  position: THREE.Vector3
  target: THREE.Vector3
}

type DragState =
  | { type: 'track'; handle: TrackHandle }
  | { type: 'lamp'; lampId: string }

type LampObjects = {
  group: THREE.Group
  body: THREE.Group
  head: THREE.Group
  spot: THREE.SpotLight
  spotTarget: THREE.Object3D
  beam: THREE.Mesh
  aperture: THREE.Mesh
  shirt: THREE.Group
}

const viewportRef = ref<HTMLDivElement | null>(null)
const cameraViewMode = ref<CameraViewMode>('display')

const layoutState = reactive({
  track: {
    startX: -3.2,
    endX: 3.2,
    y: 3.35,
    z: -1.05,
  },
  lamps: [
    { id: 'lamp-1', name: '新品展示区', x: -2.15, targetX: -2.25, brightness: 72, temperature: 3000, clothingColor: '#d45a48' },
    { id: 'lamp-2', name: '主通道区', x: 0, targetX: 0, brightness: 88, temperature: 4000, clothingColor: '#8fb95a' },
    { id: 'lamp-3', name: '橱窗区', x: 2.05, targetX: 2.25, brightness: 56, temperature: 6000, clothingColor: '#4d86d9' },
  ] as LampLayout[],
  camera: {
    x: 4.05,
    y: 2.05,
    z: -1.88,
  },
})

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animationFrame = 0
let cameraAnimationFrame = 0
let railMesh: THREE.Mesh | null = null
let railGrooveMesh: THREE.Mesh | null = null
let railHighlightMesh: THREE.Mesh | null = null
const railSupportMeshes: THREE.Mesh[] = []
let leftHandleMesh: THREE.Mesh | null = null
let rightHandleMesh: THREE.Mesh | null = null
let dragState: DragState | null = null

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -layoutState.track.z)
const dragPoint = new THREE.Vector3()
const beamAxis = new THREE.Vector3(0, -1, 0)
const displayWallZ = -2.42
const shirtBaseY = 0.72
const shirtAimY = 1.26
const wallLightSpotZ = displayWallZ + 0.065
const pickableObjects: THREE.Object3D[] = []
const lampObjects = new Map<string, LampObjects>()
const cameraViewPresets: Record<CameraViewMode, CameraViewPreset> = {
  display: {
    position: new THREE.Vector3(3.8, 2.8, 4.2),
    target: new THREE.Vector3(0, 1.35, -2.1),
  },
  adjust: {
    position: new THREE.Vector3(0, 3.4, 2.2),
    target: new THREE.Vector3(0, 2, -2.1),
  },
}

onMounted(() => {
  initThreeScene()
})

onBeforeUnmount(() => {
  cleanupThreeScene()
})

function initThreeScene() {
  const host = viewportRef.value
  if (!host) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#eef4fb')
  scene.fog = new THREE.Fog('#eef4fb', 7, 16)

  camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100)
  camera.position.copy(cameraViewPresets.display.position)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(host.clientWidth, host.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 3.4
  controls.maxDistance = 8.5
  controls.enablePan = false
  controls.minPolarAngle = Math.PI / 5
  controls.maxPolarAngle = Math.PI / 2.35
  controls.minAzimuthAngle = -Math.PI / 5
  controls.maxAzimuthAngle = Math.PI / 5
  controls.target.copy(cameraViewPresets.display.target)

  createStoreSpace()
  createTrack()
  createMockLamps()
  createCameraNode()
  updateLayoutVisuals()

  renderer.domElement.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('resize', handleResize)

  animate()
}

function createStoreSpace() {
  if (!scene) return

  const ambient = new THREE.HemisphereLight('#fafcff', '#d8c5ad', 1.55)
  scene.add(ambient)

  const fill = new THREE.DirectionalLight('#ffffff', 0.52)
  fill.position.set(-3.2, 4.8, 4.1)
  fill.castShadow = true
  scene.add(fill)

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 0.08, 6.1),
    new THREE.MeshStandardMaterial({ color: '#d9c9b8', roughness: 0.7 }),
  )
  floor.position.set(0, -0.04, 0.35)
  floor.receiveShadow = true
  scene.add(floor)

  const floorInset = new THREE.Mesh(
    new THREE.BoxGeometry(7.75, 0.012, 4.45),
    new THREE.MeshStandardMaterial({ color: '#ecdecc', roughness: 0.82 }),
  )
  floorInset.position.set(0, 0.012, 0.42)
  floorInset.receiveShadow = true
  scene.add(floorInset)


  const seamMaterial = new THREE.MeshBasicMaterial({ color: '#a18e78', transparent: true, opacity: 0.1 })
  for (const z of [-1.85, -1.05, -0.25, 0.55, 1.35, 2.15]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.009, 0.007), seamMaterial)
    seam.position.set(0, 0.03, z)
    scene.add(seam)
  }
  for (const x of [-3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.009, 4.28), seamMaterial)
    seam.position.set(x, 0.031, 0.42)
    scene.add(seam)
  }

  const floorWashMaterial = new THREE.MeshBasicMaterial({ color: '#fff6e8', transparent: true, opacity: 0.055 })
  const floorWash = new THREE.Mesh(new THREE.BoxGeometry(7.15, 0.006, 3.6), floorWashMaterial)
  floorWash.position.set(0.15, 0.038, 0.34)
  scene.add(floorWash)

  const wallMaterial = new THREE.MeshStandardMaterial({ color: '#f2eee8', roughness: 0.86 })
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(8.9, 3.6, 0.1), wallMaterial)
  backWall.position.set(0, 1.8, displayWallZ - 0.055)
  backWall.receiveShadow = true
  scene.add(backWall)

  const ceilingStrip = new THREE.Mesh(
    new THREE.BoxGeometry(8.05, 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: '#fffaf2', roughness: 0.72 }),
  )
  ceilingStrip.position.set(0, 2.72, displayWallZ + 0.03)
  scene.add(ceilingStrip)

  const coveShadow = new THREE.Mesh(
    new THREE.BoxGeometry(8.05, 0.018, 0.04),
    new THREE.MeshBasicMaterial({ color: '#d6c7b8', transparent: true, opacity: 0.2 }),
  )
  coveShadow.position.set(0, 2.62, displayWallZ + 0.065)
  scene.add(coveShadow)

  const wallLineMaterial = new THREE.MeshBasicMaterial({ color: '#d7c8b8', transparent: true, opacity: 0.24 })
  for (const x of [-3.35, -1.12, 1.12, 3.35]) {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.018, 2.42, 0.026), wallLineMaterial)
    divider.position.set(x, 1.47, displayWallZ + 0.025)
    scene.add(divider)
  }

  const panelMaterial = new THREE.MeshStandardMaterial({ color: '#fff8ef', roughness: 0.74 })
  const panelBorderMaterial = new THREE.MeshStandardMaterial({ color: '#dcc9b3', roughness: 0.64, metalness: 0.03 })
  const rackMaterial = new THREE.MeshStandardMaterial({ color: '#7b8794', roughness: 0.36, metalness: 0.46 })
  const displayXs = [-2.25, 0, 2.25]

  for (const x of displayXs) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.85, 0.04), panelMaterial)
    panel.position.set(x, 1.45, displayWallZ + 0.04)
    panel.receiveShadow = true
    scene.add(panel)

    const topBorder = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.035, 0.035), panelBorderMaterial)
    topBorder.position.set(x, 2.39, displayWallZ + 0.072)
    topBorder.castShadow = true
    scene.add(topBorder)

    const labelPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.105, 0.026),
      new THREE.MeshStandardMaterial({ color: '#efe3d3', roughness: 0.7 }),
    )
    labelPlate.position.set(x, 2.2, displayWallZ + 0.086)
    scene.add(labelPlate)

    const accentLine = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 0.018, 0.02),
      new THREE.MeshBasicMaterial({ color: '#c7a987', transparent: true, opacity: 0.34 }),
    )
    accentLine.position.set(x, 2.115, displayWallZ + 0.092)
    scene.add(accentLine)

    const bottomBorder = topBorder.clone()
    bottomBorder.position.y = 0.51
    scene.add(bottomBorder)

    for (const sideX of [-0.86, 0.86]) {
      const sideBorder = new THREE.Mesh(new THREE.BoxGeometry(0.032, 1.84, 0.034), panelBorderMaterial)
      sideBorder.position.set(x + sideX, 1.45, displayWallZ + 0.072)
      sideBorder.castShadow = true
      scene.add(sideBorder)
    }

    const rack = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.18, 18), rackMaterial)
    rack.position.set(x, 1.92, displayWallZ + 0.16)
    rack.rotation.z = Math.PI / 2
    rack.castShadow = true
    scene.add(rack)

    const hangerHook = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.009, 8, 20, Math.PI), rackMaterial)
    hangerHook.position.set(x, 1.84, displayWallZ + 0.18)
    hangerHook.rotation.x = Math.PI / 2
    hangerHook.castShadow = true
    scene.add(hangerHook)
  }

  const sideWallMaterial = new THREE.MeshStandardMaterial({ color: '#eee4da', roughness: 0.88 })
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.25, 5.65), sideWallMaterial)
  leftWall.position.set(-4.45, 1.62, 0.2)
  leftWall.receiveShadow = true
  scene.add(leftWall)

  const rightWall = leftWall.clone()
  rightWall.position.x = 4.45
  scene.add(rightWall)


  const cabinetMaterial = new THREE.MeshStandardMaterial({ color: '#c4ad91', roughness: 0.72 })
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.38, 0.42), cabinetMaterial)
  cabinet.position.set(0, 0.19, displayWallZ + 0.36)
  cabinet.castShadow = true
  cabinet.receiveShadow = true
  scene.add(cabinet)

  const cabinetTop = new THREE.Mesh(
    new THREE.BoxGeometry(7.18, 0.045, 0.46),
    new THREE.MeshStandardMaterial({ color: '#dac7ad', roughness: 0.68 }),
  )
  cabinetTop.position.set(0, 0.405, displayWallZ + 0.36)
  cabinetTop.castShadow = true
  scene.add(cabinetTop)

  const drawerLineMaterial = new THREE.MeshBasicMaterial({ color: '#8f765d', transparent: true, opacity: 0.2 })
  const cabinetEdgeMaterial = new THREE.MeshBasicMaterial({ color: '#f0dcc0', transparent: true, opacity: 0.28 })
  const cabinetShadowMaterial = new THREE.MeshBasicMaterial({ color: '#7d6045', transparent: true, opacity: 0.16 })

  const topEdge = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.018, 0.012), cabinetEdgeMaterial)
  topEdge.position.set(0, 0.398, displayWallZ + 0.59)
  scene.add(topEdge)

  const bottomShadow = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.022, 0.012), cabinetShadowMaterial)
  bottomShadow.position.set(0, 0.02, displayWallZ + 0.585)
  scene.add(bottomShadow)

  const horizontalDrawerLine = new THREE.Mesh(new THREE.BoxGeometry(6.85, 0.014, 0.012), drawerLineMaterial)
  horizontalDrawerLine.position.set(0, 0.215, displayWallZ + 0.575)
  scene.add(horizontalDrawerLine)

  for (const y of [0.12, 0.31]) {
    const woodLine = new THREE.Mesh(
      new THREE.BoxGeometry(6.72, 0.008, 0.01),
      new THREE.MeshBasicMaterial({ color: '#9a8066', transparent: true, opacity: 0.12 }),
    )
    woodLine.position.set(0, y, displayWallZ + 0.578)
    scene.add(woodLine)
  }

  for (const x of [-2.35, 0, 2.35]) {
    const drawerLine = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.012), drawerLineMaterial)
    drawerLine.position.set(x, 0.19, displayWallZ + 0.574)
    scene.add(drawerLine)
  }
}

function createTrack() {
  if (!scene) return

  railMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.1, 0.18),
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.42, metalness: 0.28 }),
  )
  railMesh.castShadow = true
  scene.add(railMesh)

  railGrooveMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.024, 0.19),
    new THREE.MeshStandardMaterial({ color: '#172033', roughness: 0.36, metalness: 0.42 }),
  )
  railGrooveMesh.castShadow = true
  scene.add(railGrooveMesh)

  railHighlightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.014, 0.028),
    new THREE.MeshBasicMaterial({ color: '#93a4b8', transparent: true, opacity: 0.42 }),
  )
  scene.add(railHighlightMesh)

  const supportMaterial = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.42, metalness: 0.32 })
  for (let index = 0; index < 3; index += 1) {
    const support = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 12), supportMaterial)
    support.castShadow = true
    railSupportMeshes.push(support)
    scene.add(support)
  }

  const handleGeometry = new THREE.SphereGeometry(0.15, 24, 16)
  const handleMaterial = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.35, metalness: 0.1 })
  leftHandleMesh = new THREE.Mesh(handleGeometry, handleMaterial)
  rightHandleMesh = new THREE.Mesh(handleGeometry.clone(), handleMaterial.clone())
  leftHandleMesh.userData.dragType = 'track-left'
  rightHandleMesh.userData.dragType = 'track-right'
  leftHandleMesh.castShadow = true
  rightHandleMesh.castShadow = true
  scene.add(leftHandleMesh, rightHandleMesh)
  pickableObjects.push(leftHandleMesh, rightHandleMesh)
}

function createMockLamps() {
  if (!scene) return
  for (const lamp of layoutState.lamps) {
    const objects = createLampObjects(lamp)
    lampObjects.set(lamp.id, objects)
    scene.add(objects.group, objects.spot, objects.spotTarget, objects.shirt)
  }
}

function createLampObjects(lamp: LampLayout): LampObjects {
  const group = new THREE.Group()
  group.userData.dragType = 'lamp'
  group.userData.lampId = lamp.id

  const mountMaterial = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.38, metalness: 0.34 })
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.15, 0.36), mountMaterial)
  mount.position.set(0, -0.11, 0)

  const mountInset = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.024, 0.2),
    new THREE.MeshBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.34 }),
  )
  mountInset.position.set(0, -0.028, 0.02)

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.44, 16),
    new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.42, metalness: 0.42 }),
  )
  rod.position.set(0, -0.42, 0)

  const yoke = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.018, 10, 28, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.42, metalness: 0.38 }),
  )
  yoke.position.set(0, -0.68, 0.03)
  yoke.rotation.z = Math.PI

  const head = new THREE.Group()
  head.position.set(0, -0.98, 0.05)

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 0.58, 40),
    new THREE.MeshStandardMaterial({ color: '#182235', roughness: 0.34, metalness: 0.3 }),
  )
  barrel.position.set(0, 0.26, 0)

  const barrelRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.045, 40),
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.28, metalness: 0.36 }),
  )
  barrelRim.position.set(0, -0.035, 0)

  const aperture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.018, 40),
    new THREE.MeshStandardMaterial({
      color: colorTemperatureHex(lamp.temperature),
      emissive: colorTemperatureHex(lamp.temperature),
      emissiveIntensity: 0.9,
    }),
  )
  aperture.position.set(0, -0.065, 0)

  head.add(barrel, barrelRim, aperture)
  group.add(mount, mountInset, rod, yoke, head)
  markLampPickable(group, lamp.id)

  const target = new THREE.Object3D()
  const spot = new THREE.SpotLight(colorTemperatureHex(lamp.temperature), 2.2, 6.5, Math.PI / 6, 0.42, 1.2)
  spot.castShadow = true
  spot.shadow.mapSize.set(1024, 1024)
  spot.target = target

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.48, 1, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: colorTemperatureHex(lamp.temperature),
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    }),
  )


  const shirt = createShirt(lamp.clothingColor)
  return { group, body: group, head, spot, spotTarget: target, beam, aperture, shirt }
}

function createShirt(color: string) {
  const shirt = new THREE.Group()
  const baseColor = new THREE.Color(color)
  const trimColor = baseColor.clone().lerp(new THREE.Color('#f1eadf'), 0.22)

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.8,
    metalness: 0.01,
    side: THREE.DoubleSide,
  })

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.88,
    metalness: 0,
  })

  const outline = new THREE.Shape()
  outline.moveTo(-0.38, 0.03)
  outline.quadraticCurveTo(-0.18, -0.015, 0.02, 0)
  outline.quadraticCurveTo(0.19, -0.018, 0.4, 0.04)
  outline.bezierCurveTo(0.36, 0.25, 0.35, 0.45, 0.43, 0.64)
  outline.bezierCurveTo(0.52, 0.63, 0.61, 0.59, 0.67, 0.53)
  outline.quadraticCurveTo(0.72, 0.62, 0.75, 0.73)
  outline.quadraticCurveTo(0.61, 0.84, 0.43, 0.9)
  outline.bezierCurveTo(0.34, 0.93, 0.25, 0.96, 0.17, 1.02)
  outline.quadraticCurveTo(0.09, 0.965, 0, 0.965)
  outline.quadraticCurveTo(-0.09, 0.965, -0.18, 1.025)
  outline.bezierCurveTo(-0.26, 0.96, -0.35, 0.93, -0.44, 0.9)
  outline.quadraticCurveTo(-0.62, 0.84, -0.76, 0.72)
  outline.quadraticCurveTo(-0.72, 0.61, -0.67, 0.52)
  outline.bezierCurveTo(-0.6, 0.59, -0.51, 0.63, -0.43, 0.64)
  outline.bezierCurveTo(-0.36, 0.44, -0.37, 0.24, -0.38, 0.03)

  const extrudeOptions = {
    depth: 0.058,
    bevelEnabled: true,
    bevelSize: 0.007,
    bevelThickness: 0.006,
    bevelSegments: 2,
  }
  const geometry = new THREE.ExtrudeGeometry(outline, extrudeOptions)
  geometry.translate(0, 0, -0.029)


  const body = new THREE.Mesh(geometry, bodyMaterial)
  body.castShadow = true
  body.receiveShadow = true

  const collarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.125, 0.952, 0.042),
    new THREE.Vector3(-0.055, 0.91, 0.048),
    new THREE.Vector3(0.03, 0.908, 0.048),
    new THREE.Vector3(0.118, 0.95, 0.042),
  ])
  const collar = new THREE.Mesh(
    new THREE.TubeGeometry(collarCurve, 24, 0.008, 8, false),
    trimMaterial,
  )

  const hem = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.014, 0.012), trimMaterial)
  hem.position.set(0.02, 0.055, 0.072)
  hem.rotation.z = 0.025

  const leftCuff = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.013, 0.012), trimMaterial)
  leftCuff.position.set(-0.62, 0.61, 0.072)
  leftCuff.rotation.z = -0.43

  const rightCuff = leftCuff.clone()
  rightCuff.position.set(0.62, 0.615, 0.046)
  rightCuff.rotation.z = 0.38


  const hanger = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: '#a3adb8', roughness: 0.48, metalness: 0.24 }),
  )
  hanger.position.set(0, 1.075, -0.014)
  hanger.rotation.z = Math.PI / 2

  shirt.add(body, collar, hem, leftCuff, rightCuff, hanger)
  shirt.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = false
    }
  })
  return shirt
}
function createCameraNode() {
  if (!scene) return

  const camGroup = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.22, 0.22),
    new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.5, metalness: 0.12 }),
  )
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.09, 24),
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#1d4ed8', emissiveIntensity: 0.16 }),
  )
  lens.position.set(0, 0, -0.155)
  lens.rotation.x = Math.PI / 2
  const bracket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.38, 12),
    new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.46, metalness: 0.32 }),
  )
  bracket.position.set(0, 0.31, 0)
  camGroup.add(body, lens, bracket)
  camGroup.position.set(layoutState.camera.x, layoutState.camera.y, layoutState.camera.z)
  camGroup.lookAt(0, 1.35, displayWallZ + 0.08)
  camGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true
  })
  scene.add(camGroup)
}

function markLampPickable(group: THREE.Group, lampId: string) {
  group.traverse((child) => {
    child.userData.dragType = 'lamp'
    child.userData.lampId = lampId
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = false
      pickableObjects.push(child)
    }
  })
}

function updateLayoutVisuals() {
  updateTrackVisuals()
  for (const lamp of layoutState.lamps) {
    updateLampVisuals(lamp)
  }
}

function updateTrackVisuals() {
  const { startX, endX, y, z } = layoutState.track
  const length = Math.max(0.1, endX - startX)
  const centerX = startX + length / 2

  if (railMesh) {
    railMesh.scale.set(length, 1, 1)
    railMesh.position.set(centerX, y, z)
  }
  if (railGrooveMesh) {
    railGrooveMesh.scale.set(Math.max(0.1, length - 0.18), 1, 1)
    railGrooveMesh.position.set(centerX, y - 0.052, z)
  }
  if (railHighlightMesh) {
    railHighlightMesh.scale.set(Math.max(0.1, length - 0.34), 1, 1)
    railHighlightMesh.position.set(centerX, y + 0.058, z - 0.058)
  }
  railSupportMeshes.forEach((support, index) => {
    const t = railSupportMeshes.length === 1 ? 0.5 : index / (railSupportMeshes.length - 1)
    const supportX = startX + length * t
    support.position.set(supportX, y + 0.28, z)
  })
  if (leftHandleMesh) leftHandleMesh.position.set(startX, y, z)
  if (rightHandleMesh) rightHandleMesh.position.set(endX, y, z)

  for (const lamp of layoutState.lamps) {
    lamp.x = clamp(lamp.x, startX, endX)
  }
}

function updateLampVisuals(lamp: LampLayout) {
  const objects = lampObjects.get(lamp.id)
  if (!objects || !scene) return

  const lampY = layoutState.track.y
  const lampZ = layoutState.track.z
  const shirtX = lamp.targetX

  objects.group.position.set(lamp.x, lampY, lampZ)
  objects.shirt.position.set(shirtX, shirtBaseY, wallLightSpotZ)

  const beamStart = new THREE.Vector3(lamp.x, lampY - 0.98, lampZ + 0.05)
  const beamEnd = new THREE.Vector3(shirtX, shirtAimY, wallLightSpotZ + 0.02)
  const beamDirection = beamEnd.clone().sub(beamStart)
  const normalizedDirection = beamDirection.clone().normalize()

  const color = new THREE.Color(colorTemperatureHex(lamp.temperature))
  const intensity = 0.45 + lamp.brightness / 100 * 3.4
  const opacity = 0.028 + lamp.brightness / 100 * 0.085

  objects.head.quaternion.setFromUnitVectors(beamAxis, normalizedDirection)

  objects.spot.color.copy(color)
  objects.spot.intensity = intensity
  objects.spot.position.copy(beamStart)
  objects.spotTarget.position.copy(beamEnd)
  objects.spot.target = objects.spotTarget

  const visibleBeamEnd = beamStart.clone().add(beamDirection.clone().multiplyScalar(1.02))
  const visibleBeamDistance = Math.max(0.1, visibleBeamEnd.distanceTo(beamStart))
  objects.beam.position.copy(beamStart.clone().add(visibleBeamEnd).multiplyScalar(0.5))
  objects.beam.scale.set(1, visibleBeamDistance, 1)
  objects.beam.quaternion.setFromUnitVectors(beamAxis, normalizedDirection)
  const beamMaterial = objects.beam.material
  if (beamMaterial instanceof THREE.MeshBasicMaterial) {
    beamMaterial.color.copy(color)
    beamMaterial.opacity = opacity
  }
  if (!objects.beam.parent) scene.add(objects.beam)


  const apertureMaterial = objects.aperture.material
  if (apertureMaterial instanceof THREE.MeshStandardMaterial) {
    apertureMaterial.color.copy(color)
    apertureMaterial.emissive.copy(color)
    apertureMaterial.emissiveIntensity = 0.45 + lamp.brightness / 100 * 1.2
  }
}

function handlePointerDown(event: PointerEvent) {
  if (!renderer || !camera) return

  updatePointer(event)
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(pickableObjects, false)
  const hit = hits.find(item => item.object.userData.dragType)
  if (!hit) return

  const dragType = hit.object.userData.dragType
  if (dragType === 'track-left') {
    dragState = { type: 'track', handle: 'left' }
  } else if (dragType === 'track-right') {
    dragState = { type: 'track', handle: 'right' }
  } else if (dragType === 'lamp') {
    dragState = { type: 'lamp', lampId: hit.object.userData.lampId }
  }

  if (!dragState) return
  event.preventDefault()
  renderer.domElement.setPointerCapture(event.pointerId)
  if (controls) controls.enabled = false
}

function handlePointerMove(event: PointerEvent) {
  if (!dragState || !camera) return
  updatePointer(event)
  raycaster.setFromCamera(pointer, camera)
  if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return

  const x = dragPoint.x
  if (dragState.type === 'track') {
    updateDraggedTrack(dragState.handle, x)
  } else {
    updateDraggedLamp(dragState.lampId, x)
  }
  updateLayoutVisuals()
}

function handlePointerUp(event: PointerEvent) {
  if (!dragState) return
  if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId)
  }
  dragState = null
  if (controls) controls.enabled = true
  logLayoutState()
}

function updateDraggedTrack(handle: TrackHandle, x: number) {
  const minLength = 2.6
  const maxLeft = layoutState.track.endX - minLength
  const minRight = layoutState.track.startX + minLength
  if (handle === 'left') {
    layoutState.track.startX = clamp(x, -4, maxLeft)
  } else {
    layoutState.track.endX = clamp(x, minRight, 4)
  }
}

function updateDraggedLamp(lampId: string, x: number) {
  const lamp = layoutState.lamps.find(item => item.id === lampId)
  if (!lamp) return
  lamp.x = clamp(x, layoutState.track.startX, layoutState.track.endX)
}

function updatePointer(event: PointerEvent) {
  if (!renderer) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

function animate() {
  if (!renderer || !scene || !camera) return
  animationFrame = requestAnimationFrame(animate)
  controls?.update()
  renderer.render(scene, camera)
}

function handleResize() {
  const host = viewportRef.value
  if (!host || !renderer || !camera) return
  const width = host.clientWidth
  const height = host.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function toggleCameraView() {
  if (dragState || !camera || !controls) return
  const nextMode: CameraViewMode = cameraViewMode.value === 'display' ? 'adjust' : 'display'
  cameraViewMode.value = nextMode
  animateCameraTo(cameraViewPresets[nextMode])
}

function animateCameraTo(preset: CameraViewPreset) {
  if (!camera || !controls) return
  if (cameraAnimationFrame) cancelAnimationFrame(cameraAnimationFrame)

  const startPosition = camera.position.clone()
  const startTarget = controls.target.clone()
  const endPosition = preset.position.clone()
  const endTarget = preset.target.clone()
  const startedAt = performance.now()
  const duration = 620

  const step = (now: number) => {
    if (!camera || !controls) return
    const progress = clamp((now - startedAt) / duration, 0, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    camera.position.lerpVectors(startPosition, endPosition, eased)
    controls.target.lerpVectors(startTarget, endTarget, eased)
    controls.update()

    if (progress < 1) {
      cameraAnimationFrame = requestAnimationFrame(step)
    } else {
      cameraAnimationFrame = 0
    }
  }

  cameraAnimationFrame = requestAnimationFrame(step)
}
function logLayoutState() {
  const snapshot = {
    track: {
      startX: round(layoutState.track.startX),
      endX: round(layoutState.track.endX),
    },
    lamps: layoutState.lamps.map(lamp => ({
      id: lamp.id,
      x: round(lamp.x),
      brightness: lamp.brightness,
      temperature: lamp.temperature,
      clothingColor: lamp.clothingColor,
      targetX: lamp.targetX,
    })),
    camera: {
      x: layoutState.camera.x,
      y: layoutState.camera.y,
      z: layoutState.camera.z,
    },
  }
  console.log('three lighting layout', JSON.stringify(snapshot, null, 2))
}

function cleanupThreeScene() {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  if (cameraAnimationFrame) cancelAnimationFrame(cameraAnimationFrame)
  renderer?.domElement.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('resize', handleResize)
  controls?.dispose()

  if (scene) {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose()
        disposeMaterial(object.material)
      }
    })
  }

  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }

  pickableObjects.length = 0
  lampObjects.clear()
  scene = null
  camera = null
  renderer = null
  controls = null
  railMesh = null
  railGrooveMesh = null
  railHighlightMesh = null
  railSupportMeshes.length = 0
  leftHandleMesh = null
  rightHandleMesh = null
  dragState = null
  cameraAnimationFrame = 0
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach(item => item.dispose())
  } else {
    material.dispose()
  }
}

function colorTemperatureHex(temp: LampTemperature) {
  if (temp <= 3000) return '#ffb35f'
  if (temp >= 6000) return '#cfe2ff'
  return '#fff2d2'
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
</script>

<style scoped>
.three-layout-shell {
  position: relative;
  overflow: hidden;
  min-height: 430px;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background:
    linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(239, 246, 255, 0.92)),
    radial-gradient(circle at 30% 20%, rgba(96, 165, 250, 0.18), transparent 32%);
}

.view-toggle-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 3;
  border: 1px solid rgba(59, 130, 246, 0.22);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.84);
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.14);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.view-toggle-btn:hover {
  transform: translateY(-1px);
  background: rgba(239, 246, 255, 0.94);
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.18);
}

.view-toggle-btn:active {
  transform: translateY(0);
}

.three-layout-viewport {
  width: 100%;
  height: 430px;
  min-height: 430px;
}

.three-layout-viewport :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.three-layout-viewport :deep(canvas:active) {
  cursor: grabbing;
}


:global(.app-container.night-mode) .three-layout-shell {
  border-color: rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.9)),
    radial-gradient(circle at 30% 20%, rgba(37, 99, 235, 0.18), transparent 32%);
}

:global(.app-container.night-mode) .view-toggle-btn {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(15, 23, 42, 0.78);
  color: #bfdbfe;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.22);
}


@media (max-width: 768px) {
  .three-layout-shell,
  .three-layout-viewport {
    min-height: 360px;
  }

  .three-layout-viewport {
    height: 360px;
  }
}
</style>






























