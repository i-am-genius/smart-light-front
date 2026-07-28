import * as THREE from 'three'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import type { GarmentPart, GarmentPosition } from '../../types/device'

export type FabricMaterialFactory = (
  color: THREE.ColorRepresentation,
) => THREE.MeshStandardMaterial

type GarmentRole = 'body' | 'structure' | 'trim' | 'seam'

type GarmentConstructionResources = {
  geometries: Set<THREE.BufferGeometry>
  materials: Set<THREE.Material>
}

const garmentDisplayBaseY = 0.72
const garmentDisplayRailWorldY = 1.98
const garmentDisplayPlinthTopWorldY = 0.448
const garmentDisplayClearance = 0.06

export const GARMENT_DISPLAY_METRICS = {
  baseY: garmentDisplayBaseY,
  railWorldY: garmentDisplayRailWorldY,
  plinthTopWorldY: garmentDisplayPlinthTopWorldY,
  clearance: garmentDisplayClearance,
  localMinY: Number((
    garmentDisplayPlinthTopWorldY
    + garmentDisplayClearance
    - garmentDisplayBaseY
  ).toFixed(3)),
  localRailY: Number((
    garmentDisplayRailWorldY - garmentDisplayBaseY
  ).toFixed(3)),
  targetOverlap: 0.025,
  minOverlap: 0.015,
  maxOverlap: 0.05,
} as const

const sharedHangerMaterial = new THREE.MeshStandardMaterial({
  color: '#b9965f',
  roughness: 0.3,
  metalness: 0.76,
})

function createConstructionResources(): GarmentConstructionResources {
  return {
    geometries: new Set<THREE.BufferGeometry>(),
    materials: new Set<THREE.Material>(),
  }
}

function trackGeometry<T extends THREE.BufferGeometry>(
  resources: GarmentConstructionResources,
  geometry: T,
): T {
  resources.geometries.add(geometry)
  return geometry
}

function releaseGarmentMaterial(material: THREE.Material): void {
  const release = material.userData.releaseGarmentMaterial
  if (typeof release === 'function' && release() === true) return
  material.dispose()
}

function cleanupConstructionResources(
  resources: GarmentConstructionResources,
): void {
  for (const geometry of resources.geometries) {
    try {
      geometry.dispose()
    } catch {
      // Preserve the construction error even if a custom disposer fails.
    }
  }
  for (const material of resources.materials) {
    try {
      releaseGarmentMaterial(material)
    } catch {
      // Preserve the construction error even if a material-library release fails.
    }
  }
}

function normalizeColor(color: string, fallback = '#888888') {
  const text = color.trim()
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) return `#${new THREE.Color(text).getHexString()}`

  const channels =
    text.match(
      /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i,
    ) ??
    text.match(/^(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)$/)
  if (!channels) return fallback

  return `#${channels
    .slice(1, 4)
    .map(value =>
      THREE.MathUtils.clamp(Math.round(Number(value)), 0, 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

function roleColor(baseColor: string, role: GarmentRole) {
  const color = new THREE.Color(baseColor)
  if (role === 'body') return color

  const trim = color.clone().lerp(new THREE.Color('#f1eadf'), 0.22)
  if (role === 'trim') return trim
  if (role === 'structure') {
    return color.clone().lerp(new THREE.Color('#f1eadf'), 0.06)
  }
  return color.multiplyScalar(0.96)
}

function createFabricMesh(
  geometry: THREE.BufferGeometry,
  position: GarmentPosition,
  role: GarmentRole,
  color: string,
  createFabricMaterial: FabricMaterialFactory,
  resources: GarmentConstructionResources,
) {
  resources.geometries.add(geometry)
  const material = createFabricMaterial(roleColor(color, role))
  resources.materials.add(material)
  material.roughness = role === 'body'
    ? 0.82
    : role === 'structure'
    ? 0.85
    : role === 'trim'
    ? 0.88
    : 0.9
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = false
  mesh.userData.garmentPosition = position
  mesh.userData.garmentRole = role
  mesh.userData.ownsGarmentGeometry = true
  mesh.userData.ownsGarmentMaterial = true
  return mesh
}

function createHanger(
  width: number,
  y: number,
  resources: GarmentConstructionResources,
) {
  const hanger = new THREE.Mesh(
    trackGeometry(
      resources,
      new THREE.CylinderGeometry(0.009, 0.009, width, 12),
    ),
    sharedHangerMaterial,
  )
  hanger.position.set(0, y, -0.014)
  hanger.rotation.z = Math.PI / 2
  hanger.castShadow = true
  hanger.receiveShadow = false
  hanger.userData.isGarmentHanger = true
  hanger.userData.ownsGarmentGeometry = true
  return hanger
}

function prepareGarmentGroup(
  position: GarmentPosition,
  category: GarmentPart['category'],
) {
  const group = new THREE.Group()
  group.userData.garmentPosition = position
  group.userData.garmentCategory = category
  return group
}

function markGarmentDetail<T extends THREE.Object3D>(object: T, detail: string) {
  object.userData.garmentDetail = detail
  return object
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = THREE.MathUtils.clamp(
    (value - edge0) / Math.max(edge1 - edge0, 0.0001),
    0,
    1,
  )
  return amount * amount * (3 - 2 * amount)
}

function addUpperGarmentUndulation(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  const position = geometry.getAttribute('position')
  if (!bounds || !position) return

  const depth = Math.max(bounds.max.z - bounds.min.z, 0.0001)
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const torsoMask = 1 - smoothstep(0.28, 0.51, Math.abs(x))
    const vertical = THREE.MathUtils.clamp((y - 0.02) / 0.96, 0, 1)
    const verticalMask = Math.pow(Math.sin(vertical * Math.PI), 1.15)
    const broadVolume = 0.037 * torsoMask * verticalMask
    const fabricWave = 0.006
      * Math.sin(x * 15 + y * 3.2)
      * torsoMask
      * Math.pow(verticalMask, 1.4)
    const surfaceDepth = (z - bounds.min.z) / depth
    const depthWeight = 1.15 * surfaceDepth - 0.15
    position.setZ(index, z + (broadVolume + fabricWave) * depthWeight)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

export function createUpperGarment(
  color: string,
  createFabricMaterial: FabricMaterialFactory,
): THREE.Group {
  const resources = createConstructionResources()
  try {
    const normalizedColor = normalizeColor(color)
    const upper = prepareGarmentGroup('upper', 'upper')

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

    const extrudedGeometry = new THREE.ExtrudeGeometry(outline, {
      depth: 0.058,
      bevelEnabled: true,
      bevelSize: 0.007,
      bevelThickness: 0.006,
      bevelSegments: 2,
    })
    extrudedGeometry.translate(0, 0, -0.029)
    const geometry = trackGeometry(
      resources,
      new TessellateModifier(0.09, 4).modify(extrudedGeometry),
    )
    extrudedGeometry.dispose()
    addUpperGarmentUndulation(geometry)
    const body = createFabricMesh(
      geometry,
      'upper',
      'body',
      normalizedColor,
      createFabricMaterial,
      resources,
    )

    const collarCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.125, 0.952, 0.042),
      new THREE.Vector3(-0.055, 0.91, 0.048),
      new THREE.Vector3(0.03, 0.908, 0.048),
      new THREE.Vector3(0.118, 0.95, 0.042),
    ])
    const collar = createFabricMesh(
      new THREE.TubeGeometry(collarCurve, 24, 0.008, 8, false),
      'upper',
      'trim',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    const hem = createFabricMesh(
      new THREE.BoxGeometry(0.58, 0.014, 0.012),
      'upper',
      'trim',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    hem.position.set(0.02, 0.055, 0.072)
    hem.rotation.z = 0.025
    hem.userData.garmentAnchor = 'hem'

    const leftCuff = createFabricMesh(
      new THREE.BoxGeometry(0.18, 0.013, 0.012),
      'upper',
      'trim',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    leftCuff.position.set(-0.62, 0.61, 0.072)
    leftCuff.rotation.z = -0.43
    const rightCuff = createFabricMesh(
      new THREE.BoxGeometry(0.18, 0.013, 0.012),
      'upper',
      'trim',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    rightCuff.position.set(0.62, 0.615, 0.046)
    rightCuff.rotation.z = 0.38

    const leftSeam = createFabricMesh(
      new THREE.BoxGeometry(0.012, 0.58, 0.01),
      'upper',
      'seam',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    leftSeam.position.set(-0.365, 0.34, 0.067)
    leftSeam.rotation.z = -0.02
    const rightSeam = createFabricMesh(
      new THREE.BoxGeometry(0.012, 0.58, 0.01),
      'upper',
      'seam',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    rightSeam.position.set(0.385, 0.34, 0.067)
    rightSeam.rotation.z = 0.02

    upper.add(
      body,
      collar,
      hem,
      leftCuff,
      rightCuff,
      leftSeam,
      rightSeam,
      createHanger(0.4, 1.075, resources),
    )
    return upper
  } catch (error) {
    cleanupConstructionResources(resources)
    throw error
  }
}

type DrapedPanelRow = {
  y: number
  halfWidth: number
  centerX?: number
  crown: number
  foldAmplitude?: number
  centerDip?: number
  hemCurve?: number
}

type DrapedPanelOptions = {
  widthSegments?: number
  thickness?: number
  foldCount?: number
  foldPhase?: number
}

function createDrapedPanelGeometry(
  rows: readonly DrapedPanelRow[],
  options: DrapedPanelOptions = {},
) {
  if (rows.length < 2) {
    throw new Error('A draped garment panel needs at least two rows')
  }

  const widthSegments = Math.max(
    6,
    Math.floor(options.widthSegments ?? 14),
  )
  const columns = widthSegments + 1
  const thickness = Math.max(0.02, options.thickness ?? 0.055)
  const foldCount = options.foldCount ?? 3.4
  const foldPhase = options.foldPhase ?? 0
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (const surface of ['front', 'back'] as const) {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]!
      const v = rowIndex / (rows.length - 1)
      for (let column = 0; column <= widthSegments; column += 1) {
        const horizontal = column / widthSegments
        const u = horizontal * 2 - 1
        const absU = Math.abs(u)
        const crownEnvelope = Math.max(0, 1 - u * u)
        const foldEnvelope = Math.pow(crownEnvelope, 0.72)
        const centerProfile = Math.pow(Math.max(0, 1 - absU), 1.6)
        const fold = (row.foldAmplitude ?? 0)
          * Math.sin((u * foldCount + foldPhase) * Math.PI)
          * foldEnvelope
        const x = (row.centerX ?? 0) + u * row.halfWidth
        const y = row.y
          - (row.centerDip ?? 0) * centerProfile
          + (row.hemCurve ?? 0) * u * u
        const z = surface === 'front'
          ? thickness / 2 + row.crown * crownEnvelope + fold
          : -thickness / 2
            - row.crown * 0.32 * crownEnvelope
            + fold * 0.12

        positions.push(x, y, z)
        uvs.push(surface === 'front' ? horizontal : 1 - horizontal, 1 - v)
      }
    }
  }

  const backOffset = rows.length * columns
  const frontIndex = (row: number, column: number) => row * columns + column
  const backIndex = (row: number, column: number) =>
    backOffset + row * columns + column

  for (let row = 0; row < rows.length - 1; row += 1) {
    for (let column = 0; column < widthSegments; column += 1) {
      const frontTopLeft = frontIndex(row, column)
      const frontTopRight = frontIndex(row, column + 1)
      const frontBottomLeft = frontIndex(row + 1, column)
      const frontBottomRight = frontIndex(row + 1, column + 1)
      indices.push(
        frontTopLeft,
        frontBottomLeft,
        frontTopRight,
        frontTopRight,
        frontBottomLeft,
        frontBottomRight,
      )

      const backTopLeft = backIndex(row, column)
      const backTopRight = backIndex(row, column + 1)
      const backBottomLeft = backIndex(row + 1, column)
      const backBottomRight = backIndex(row + 1, column + 1)
      indices.push(
        backTopLeft,
        backTopRight,
        backBottomLeft,
        backTopRight,
        backBottomRight,
        backBottomLeft,
      )
    }
  }

  for (let column = 0; column < widthSegments; column += 1) {
    const frontTopLeft = frontIndex(0, column)
    const frontTopRight = frontIndex(0, column + 1)
    const backTopLeft = backIndex(0, column)
    const backTopRight = backIndex(0, column + 1)
    indices.push(
      frontTopLeft,
      frontTopRight,
      backTopLeft,
      frontTopRight,
      backTopRight,
      backTopLeft,
    )

    const lastRow = rows.length - 1
    const frontBottomLeft = frontIndex(lastRow, column)
    const frontBottomRight = frontIndex(lastRow, column + 1)
    const backBottomLeft = backIndex(lastRow, column)
    const backBottomRight = backIndex(lastRow, column + 1)
    indices.push(
      frontBottomLeft,
      backBottomLeft,
      frontBottomRight,
      frontBottomRight,
      backBottomLeft,
      backBottomRight,
    )
  }

  for (let row = 0; row < rows.length - 1; row += 1) {
    const frontLeftTop = frontIndex(row, 0)
    const backLeftTop = backIndex(row, 0)
    const frontLeftBottom = frontIndex(row + 1, 0)
    const backLeftBottom = backIndex(row + 1, 0)
    indices.push(
      frontLeftTop,
      backLeftTop,
      frontLeftBottom,
      backLeftTop,
      backLeftBottom,
      frontLeftBottom,
    )

    const lastColumn = widthSegments
    const frontRightTop = frontIndex(row, lastColumn)
    const backRightTop = backIndex(row, lastColumn)
    const frontRightBottom = frontIndex(row + 1, lastColumn)
    const backRightBottom = backIndex(row + 1, lastColumn)
    indices.push(
      frontRightTop,
      frontRightBottom,
      backRightTop,
      frontRightBottom,
      backRightBottom,
      backRightTop,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData.isDrapedPanel = true
  return geometry
}

function createDrapedFabricMesh(
  rows: readonly DrapedPanelRow[],
  options: DrapedPanelOptions,
  position: GarmentPosition,
  role: GarmentRole,
  color: string,
  createFabricMaterial: FabricMaterialFactory,
  resources: GarmentConstructionResources,
  panel?: string,
) {
  const mesh = createFabricMesh(
    createDrapedPanelGeometry(rows, options),
    position,
    role,
    color,
    createFabricMaterial,
    resources,
  )
  if (panel) mesh.userData.garmentPanel = panel
  return mesh
}

export function createPantsGarment(
  color: string,
  createFabricMaterial: FabricMaterialFactory,
): THREE.Group {
  const resources = createConstructionResources()
  try {
    const normalizedColor = normalizeColor(color)
    const pants = prepareGarmentGroup('lower', 'pants')
    const leftLeg = createDrapedFabricMesh(
      [
        { y: 0.5, centerX: -0.17, halfWidth: 0.17, crown: 0.04, foldAmplitude: 0.002 },
        { y: 0.42, centerX: -0.195, halfWidth: 0.195, crown: 0.058, foldAmplitude: 0.003 },
        { y: 0.28, centerX: -0.195, halfWidth: 0.195, crown: 0.065, foldAmplitude: 0.004 },
        { y: 0.12, centerX: -0.17, halfWidth: 0.17, crown: 0.054, foldAmplitude: 0.004 },
        { y: -0.04, centerX: -0.18, halfWidth: 0.155, crown: 0.048, foldAmplitude: 0.005 },
        { y: -0.3, centerX: -0.172, halfWidth: 0.142, crown: 0.042, foldAmplitude: 0.006 },
        { y: -0.715, centerX: -0.17, halfWidth: 0.13, crown: 0.035, foldAmplitude: 0.005 },
      ],
      { widthSegments: 14, thickness: 0.056, foldCount: 1.65, foldPhase: -0.1 },
      'lower',
      'body',
      normalizedColor,
      createFabricMaterial,
      resources,
      'left-trouser',
    )

    const rightLeg = createDrapedFabricMesh(
      [
        { y: 0.5, centerX: 0.17, halfWidth: 0.17, crown: 0.039, foldAmplitude: 0.002 },
        { y: 0.42, centerX: 0.195, halfWidth: 0.195, crown: 0.057, foldAmplitude: 0.003 },
        { y: 0.28, centerX: 0.195, halfWidth: 0.195, crown: 0.064, foldAmplitude: 0.004 },
        { y: 0.115, centerX: 0.17, halfWidth: 0.17, crown: 0.053, foldAmplitude: 0.004 },
        { y: -0.045, centerX: 0.182, halfWidth: 0.156, crown: 0.047, foldAmplitude: 0.005 },
        { y: -0.305, centerX: 0.176, halfWidth: 0.143, crown: 0.041, foldAmplitude: 0.006 },
        { y: -0.72, centerX: 0.174, halfWidth: 0.13, crown: 0.034, foldAmplitude: 0.005 },
      ],
      { widthSegments: 14, thickness: 0.056, foldCount: 1.72, foldPhase: 0.15 },
      'lower',
      'body',
      normalizedColor,
      createFabricMaterial,
      resources,
      'right-trouser',
    )

    const waistband = createDrapedFabricMesh(
      [
        { y: 0.51, halfWidth: 0.33, crown: 0.042, foldAmplitude: 0.002 },
        { y: 0.43, halfWidth: 0.36, crown: 0.056, foldAmplitude: 0.003 },
      ],
      { widthSegments: 14, thickness: 0.06, foldCount: 2.2, foldPhase: 0.15 },
      'lower',
      'structure',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    waistband.userData.garmentAnchor = 'waist'

    const leftHem = createDrapedFabricMesh(
      [
        { y: -0.65, centerX: -0.17, halfWidth: 0.132, crown: 0.036, foldAmplitude: 0.004 },
        { y: -0.72, centerX: -0.17, halfWidth: 0.13, crown: 0.034, foldAmplitude: 0.004 },
      ],
      { widthSegments: 10, thickness: 0.054, foldCount: 1.7, foldPhase: -0.12 },
      'lower',
      'structure',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    const rightHem = createDrapedFabricMesh(
      [
        { y: -0.655, centerX: 0.174, halfWidth: 0.132, crown: 0.035, foldAmplitude: 0.004 },
        { y: -0.725, centerX: 0.174, halfWidth: 0.13, crown: 0.033, foldAmplitude: 0.004 },
      ],
      { widthSegments: 10, thickness: 0.054, foldCount: 1.8, foldPhase: 0.17 },
      'lower',
      'structure',
      normalizedColor,
      createFabricMaterial,
      resources,
    )

    const fly = markGarmentDetail(
      createFabricMesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.42, 0.032),
            new THREE.Vector3(0.008, 0.31, 0.036),
            new THREE.Vector3(0.004, 0.19, 0.035),
            new THREE.Vector3(0, 0.11, 0.032),
          ]),
          18,
          0.0024,
          5,
          false,
        ),
        'lower',
        'seam',
        normalizedColor,
        createFabricMaterial,
        resources,
      ),
      'fly',
    )

    pants.add(leftLeg, rightLeg, waistband, leftHem, rightHem, fly)
    for (const side of [-1, 1] as const) {
      const pocket = markGarmentDetail(
        createFabricMesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(side * 0.315, 0.385, 0.079),
              new THREE.Vector3(side * 0.275, 0.32, 0.086),
              new THREE.Vector3(side * 0.195, 0.255, 0.091),
            ]),
            18,
            0.0023,
            5,
            false,
          ),
          'lower',
          'seam',
          normalizedColor,
          createFabricMaterial,
          resources,
        ),
        'pocket-opening',
      )
      pants.add(pocket)
    }
    pants.add(createHanger(0.62, 0.62, resources))
    return pants
  } catch (error) {
    cleanupConstructionResources(resources)
    throw error
  }
}

export function createSkirtGarment(
  color: string,
  createFabricMaterial: FabricMaterialFactory,
): THREE.Group {
  const resources = createConstructionResources()
  try {
    const normalizedColor = normalizeColor(color)
    const skirt = prepareGarmentGroup('lower', 'skirt')
    const body = createDrapedFabricMesh(
      [
        { y: 0.5, halfWidth: 0.33, crown: 0.042, foldAmplitude: 0.003 },
        { y: 0.43, halfWidth: 0.34, crown: 0.055, foldAmplitude: 0.004 },
        { y: 0.27, centerX: 0.003, halfWidth: 0.35, crown: 0.064, foldAmplitude: 0.006 },
        { y: 0.08, centerX: -0.004, halfWidth: 0.38, crown: 0.064, foldAmplitude: 0.009 },
        { y: -0.16, centerX: 0.004, halfWidth: 0.43, crown: 0.06, foldAmplitude: 0.014 },
        { y: -0.4, centerX: -0.006, halfWidth: 0.47, crown: 0.055, foldAmplitude: 0.023 },
        { y: -0.64, centerX: 0.008, halfWidth: 0.5, crown: 0.045, foldAmplitude: 0.032, hemCurve: 0.025 },
      ],
      { widthSegments: 16, thickness: 0.058, foldCount: 3.3, foldPhase: 0.11 },
      'lower',
      'body',
      normalizedColor,
      createFabricMaterial,
      resources,
      'skirt',
    )

    const waistband = createDrapedFabricMesh(
      [
        { y: 0.51, halfWidth: 0.33, crown: 0.042, foldAmplitude: 0.002 },
        { y: 0.43, halfWidth: 0.34, crown: 0.054, foldAmplitude: 0.003 },
      ],
      { widthSegments: 14, thickness: 0.06, foldCount: 2.4, foldPhase: 0.11 },
      'lower',
      'structure',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    waistband.userData.garmentAnchor = 'waist'

    const hem = createDrapedFabricMesh(
      [
        { y: -0.575, centerX: 0.004, halfWidth: 0.49, crown: 0.049, foldAmplitude: 0.029, hemCurve: 0.016 },
        { y: -0.64, centerX: 0.008, halfWidth: 0.5, crown: 0.044, foldAmplitude: 0.032, hemCurve: 0.025 },
      ],
      { widthSegments: 16, thickness: 0.06, foldCount: 3.3, foldPhase: 0.11 },
      'lower',
      'structure',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    skirt.add(body, waistband, hem, createHanger(0.62, 0.61, resources))
    return skirt
  } catch (error) {
    cleanupConstructionResources(resources)
    throw error
  }
}

export function createDressGarment(
  color: string,
  createFabricMaterial: FabricMaterialFactory,
): THREE.Group {
  const resources = createConstructionResources()
  try {
    const normalizedColor = normalizeColor(color)
    const dress = prepareGarmentGroup('fullBody', 'dress')
    const body = createDrapedFabricMesh(
      [
        { y: 0.88, halfWidth: 0.29, crown: 0.04, foldAmplitude: 0.002, centerDip: 0.14 },
        { y: 0.65, halfWidth: 0.34, crown: 0.075, foldAmplitude: 0.004 },
        { y: 0.42, centerX: -0.004, halfWidth: 0.3, crown: 0.068, foldAmplitude: 0.005 },
        { y: 0.16, centerX: 0.003, halfWidth: 0.255, crown: 0.045, foldAmplitude: 0.004 },
        { y: 0.04, centerX: -0.002, halfWidth: 0.27, crown: 0.045, foldAmplitude: 0.006 },
        { y: -0.18, centerX: 0.004, halfWidth: 0.36, crown: 0.055, foldAmplitude: 0.014 },
        { y: -0.42, centerX: -0.006, halfWidth: 0.45, crown: 0.055, foldAmplitude: 0.024 },
        { y: -0.67, centerX: 0.008, halfWidth: 0.51, crown: 0.045, foldAmplitude: 0.034, hemCurve: 0.025 },
      ],
      { widthSegments: 16, thickness: 0.06, foldCount: 3.5, foldPhase: 0.13 },
      'fullBody',
      'body',
      normalizedColor,
      createFabricMaterial,
      resources,
      'dress',
    )

    const necklinePoints = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1].map(u => {
      const envelope = Math.max(0, 1 - u * u)
      return new THREE.Vector3(
        u * 0.29,
        0.88 - 0.14 * Math.pow(Math.max(0, 1 - Math.abs(u)), 1.6),
        0.032 + 0.04 * envelope,
      )
    })
    const neckline = markGarmentDetail(
      createFabricMesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(necklinePoints),
          32,
          0.003,
          5,
          false,
        ),
        'fullBody',
        'structure',
        normalizedColor,
        createFabricMaterial,
        resources,
      ),
      'neckline-binding',
    )

    const hem = createDrapedFabricMesh(
      [
        { y: -0.605, centerX: 0.004, halfWidth: 0.5, crown: 0.049, foldAmplitude: 0.031, hemCurve: 0.016 },
        { y: -0.67, centerX: 0.008, halfWidth: 0.51, crown: 0.044, foldAmplitude: 0.034, hemCurve: 0.025 },
      ],
      { widthSegments: 16, thickness: 0.062, foldCount: 3.5, foldPhase: 0.13 },
      'fullBody',
      'structure',
      normalizedColor,
      createFabricMaterial,
      resources,
    )
    dress.add(body, neckline, hem, createHanger(0.48, 0.98, resources))
    return dress
  } catch (error) {
    cleanupConstructionResources(resources)
    throw error
  }
}

function garmentColor(garment: GarmentPart) {
  return normalizeColor(garment.mainColorRgb)
}

function displaySignature(garments: GarmentPart[]) {
  return garments
    .map(item => `${item.position}:${item.category}`)
    .sort()
    .join('|')
}

function findGarmentHanger(model: THREE.Group) {
  let hanger: THREE.Mesh | undefined
  model.traverse(child => {
    if (
      !hanger
      && child instanceof THREE.Mesh
      && child.userData.isGarmentHanger === true
    ) {
      hanger = child
    }
  })
  return hanger
}

function measureGarmentMeshes(
  model: THREE.Object3D,
  include: (mesh: THREE.Mesh) => boolean,
) {
  model.updateWorldMatrix(true, true)
  const bounds = new THREE.Box3().makeEmpty()
  const meshBounds = new THREE.Box3()
  const inverseModelMatrix = new THREE.Matrix4()
    .copy(model.matrixWorld)
    .invert()
  const relativeMatrix = new THREE.Matrix4()
  model.traverse(child => {
    if (!(child instanceof THREE.Mesh) || !include(child)) return
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
    if (!child.geometry.boundingBox) return
    relativeMatrix.multiplyMatrices(inverseModelMatrix, child.matrixWorld)
    meshBounds.copy(child.geometry.boundingBox).applyMatrix4(relativeMatrix)
    bounds.union(meshBounds)
  })
  return bounds
}

function measureGarmentContent(model: THREE.Object3D) {
  return measureGarmentMeshes(
    model,
    mesh => mesh.userData.isGarmentHanger !== true,
  )
}

function findGarmentAnchor(model: THREE.Group, anchor: 'hem' | 'waist') {
  let match: THREE.Mesh | undefined
  model.traverse(child => {
    if (
      !match
      && child instanceof THREE.Mesh
      && child.userData.garmentAnchor === anchor
    ) {
      match = child
    }
  })
  return match
}

function measureGarmentAnchor(model: THREE.Group, anchor: THREE.Mesh) {
  return measureGarmentMeshes(model, mesh => mesh === anchor)
}

function setGarmentScale(model: THREE.Group, scale: number) {
  const effectiveScale = THREE.MathUtils.clamp(scale, 0.01, 1)
  model.scale.setScalar(effectiveScale)
  return effectiveScale
}

function alignSingleGarmentToRail(model: THREE.Group) {
  const hanger = findGarmentHanger(model)
  if (!hanger) return
  const bounds = measureGarmentContent(model)
  const hangingSpan = hanger.position.y - bounds.min.y
  const availableHeight =
    GARMENT_DISPLAY_METRICS.localRailY - GARMENT_DISPLAY_METRICS.localMinY
  const scale = Math.min(
    1,
    availableHeight / Math.max(hangingSpan, 0.001),
  )
  const effectiveScale = setGarmentScale(model, scale)
  model.position.y =
    GARMENT_DISPLAY_METRICS.localRailY - hanger.position.y * effectiveScale
}

function arrangeTwoPieceOutfit(upper: THREE.Group, lower: THREE.Group) {
  const upperHanger = findGarmentHanger(upper)
  const lowerHanger = findGarmentHanger(lower)
  if (!upperHanger) return

  const upperBounds = measureGarmentContent(upper)
  const lowerBounds = measureGarmentContent(lower)
  const upperHem = findGarmentAnchor(upper, 'hem')
  const lowerWaist = findGarmentAnchor(lower, 'waist')
  const upperConnectionY = upperHem
    ? measureGarmentAnchor(upper, upperHem).min.y
    : upperBounds.min.y
  const lowerConnectionY = lowerWaist
    ? measureGarmentAnchor(lower, lowerWaist).max.y
    : lowerBounds.max.y
  const upperHangDepth = upperHanger.position.y - upperConnectionY
  const lowerDrop = lowerConnectionY - lowerBounds.min.y
  const naturalHeight = upperHangDepth + lowerDrop
  const availableHeight =
    GARMENT_DISPLAY_METRICS.localRailY
    + GARMENT_DISPLAY_METRICS.targetOverlap
    - GARMENT_DISPLAY_METRICS.localMinY
  const requestedScale = Math.min(
    1,
    availableHeight / Math.max(naturalHeight, 0.001),
  )

  const scale = setGarmentScale(upper, requestedScale)
  setGarmentScale(lower, scale)
  upper.position.y =
    GARMENT_DISPLAY_METRICS.localRailY - upperHanger.position.y * scale
  const upperConnection = upper.position.y + upperConnectionY * scale
  lower.position.y =
    upperConnection
    + GARMENT_DISPLAY_METRICS.targetOverlap
    - lowerConnectionY * scale
  lower.position.z = -0.008
  if (lowerHanger) lowerHanger.visible = false
}

function layoutGarmentModels(
  display: THREE.Group,
  hasUpper: boolean,
  hasLower: boolean,
) {
  const upper = display.children.find(
    child =>
      child instanceof THREE.Group
      && child.userData.garmentPosition === 'upper',
  ) as THREE.Group | undefined
  const lower = display.children.find(
    child =>
      child instanceof THREE.Group
      && child.userData.garmentPosition === 'lower',
  ) as THREE.Group | undefined
  const fullBody = display.children.find(
    child =>
      child instanceof THREE.Group
      && child.userData.garmentPosition === 'fullBody',
  ) as THREE.Group | undefined

  if (hasUpper && hasLower && upper && lower) {
    arrangeTwoPieceOutfit(upper, lower)
    return
  }
  if (lower) alignSingleGarmentToRail(lower)
  if (fullBody) alignSingleGarmentToRail(fullBody)
}

export function createGarmentDisplay(
  garments: GarmentPart[],
  createFabricMaterial: FabricMaterialFactory,
): THREE.Group {
  const display = new THREE.Group()
  const fullBody = garments.find(
    item => item.position === 'fullBody' && item.category === 'dress',
  )
  const selected = fullBody
    ? [fullBody]
    : garments.filter(
        item => item.position === 'upper' || item.position === 'lower',
      )

  let pendingModel: THREE.Group | undefined
  try {
    for (const garment of selected) {
      const color = garmentColor(garment)
      pendingModel =
        garment.category === 'upper'
          ? createUpperGarment(color, createFabricMaterial)
          : garment.category === 'pants'
          ? createPantsGarment(color, createFabricMaterial)
          : garment.category === 'skirt'
          ? createSkirtGarment(color, createFabricMaterial)
          : createDressGarment(color, createFabricMaterial)
      display.add(pendingModel)
      pendingModel = undefined
    }

    const hasUpper = selected.some(item => item.position === 'upper')
    const hasLower = selected.some(item => item.position === 'lower')
    layoutGarmentModels(display, hasUpper, hasLower)

    display.userData.garmentSignature = displaySignature(selected)
    updateGarmentDisplayColors(display, selected)
    return display
  } catch (error) {
    if (pendingModel && pendingModel.parent !== display) {
      try {
        disposeGarmentDisplay(pendingModel)
      } catch {
        // Preserve the construction error.
      }
    }
    try {
      disposeGarmentDisplay(display)
    } catch {
      // Preserve the construction error.
    }
    throw error
  }
}

export function syncGarmentDisplayInScene(
  scene: THREE.Scene,
  owner: { garmentDisplay: THREE.Group },
  garments: GarmentPart[],
  expectedSignature: string,
  createFabricMaterial: FabricMaterialFactory,
): void {
  const previousDisplay = owner.garmentDisplay
  if (previousDisplay.userData.garmentSignature === expectedSignature) {
    updateGarmentDisplayColors(previousDisplay, garments)
    return
  }

  let nextDisplay: THREE.Group | undefined

  try {
    nextDisplay = createGarmentDisplay(garments, createFabricMaterial)
    nextDisplay.position.copy(previousDisplay.position)
    nextDisplay.quaternion.copy(previousDisplay.quaternion)
    nextDisplay.scale.copy(previousDisplay.scale)
    scene.add(nextDisplay)
  } catch (error) {
    if (nextDisplay) {
      if (nextDisplay.parent === scene) scene.remove(nextDisplay)
      try {
        disposeGarmentDisplay(nextDisplay)
      } catch {
        // Preserve the creation/swap error.
      }
    }
    throw error
  }

  owner.garmentDisplay = nextDisplay
  scene.remove(previousDisplay)
  disposeGarmentDisplay(previousDisplay)
}

export function updateGarmentDisplayColors(
  display: THREE.Group,
  garments: GarmentPart[],
): void {
  const colors = Object.fromEntries(
    garments.map(item => [item.position, garmentColor(item)]),
  ) as Partial<Record<GarmentPosition, string>>

  display.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    const position = child.userData.garmentPosition as
      | GarmentPosition
      | undefined
    const role = child.userData.garmentRole as GarmentRole | undefined
    const color = position ? colors[position] : undefined
    if (!color || !role) return

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.copy(roleColor(color, role))
      }
    }
  })

  display.userData.garmentColors = colors
}

export function disposeGarmentDisplay(display: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  display.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    if (
      child.userData.ownsGarmentGeometry === true &&
      !geometries.has(child.geometry)
    ) {
      geometries.add(child.geometry)
      child.geometry.dispose()
    }
    if (child.userData.ownsGarmentMaterial !== true) return

    const ownedMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    for (const material of ownedMaterials) {
      if (materials.has(material)) continue
      materials.add(material)
      releaseGarmentMaterial(material)
    }
  })
  display.clear()
}
