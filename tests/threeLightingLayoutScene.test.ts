import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import * as THREE from 'three'
import type {
  GarmentCategory,
  GarmentPart,
  GarmentPosition,
} from '../src/types/device.ts'
import {
  createDressGarment,
  createGarmentDisplay,
  createPantsGarment,
  createSkirtGarment,
  createUpperGarment,
  disposeGarmentDisplay,
  updateGarmentDisplayColors,
} from '../src/components/device/threeGarmentModels.ts'
import * as garmentModelLifecycle from '../src/components/device/threeGarmentModels.ts'

const component = readFileSync(
  new URL('../src/components/device/ThreeLightingLayout.vue', import.meta.url),
  'utf8',
)

function sourceBlock(source: string, marker: string) {
  const start = source.indexOf(marker)
  assert.ok(start >= 0, `expected source marker: ${marker}`)

  const openingBrace = source.indexOf('{', start)
  assert.ok(openingBrace >= 0, `expected opening brace after: ${marker}`)

  let depth = 0
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] !== '}') continue
    depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }

  assert.fail(`expected closing brace after: ${marker}`)
}

function sourceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker)
  assert.ok(start >= 0, `expected source marker: ${startMarker}`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(
    end > start,
    `expected source marker after ${startMarker}: ${endMarker}`,
  )
  return source.slice(start, end)
}

function countMatches(source: string, pattern: RegExp) {
  const flags = pattern.flags.includes('g')
    ? pattern.flags
    : `${pattern.flags}g`
  return [...source.matchAll(new RegExp(pattern.source, flags))].length
}

function lightConstructors(source: string) {
  return [...source.matchAll(/new\s+THREE\.(\w*Light)\s*\(/g)].map(
    match => match[1],
  )
}

function garment(
  position: GarmentPosition,
  category: GarmentCategory,
  mainColorRgb: string,
): GarmentPart {
  return {
    position,
    category,
    categoryConfidence: 0.9,
    fabric: 'cotton',
    mainColorRgb,
    maskArea: 100,
  }
}

function createFabricMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({ color })
}

function garmentGroups(display: THREE.Group) {
  return display.children.filter(
    child => typeof child.userData.garmentPosition === 'string',
  )
}

function bodyMeshes(display: THREE.Group) {
  const meshes: THREE.Mesh[] = []
  display.traverse(child => {
    if (child instanceof THREE.Mesh && child.userData.garmentRole === 'body') {
      meshes.push(child)
    }
  })
  return meshes
}

type TestGarmentRole = 'body' | 'structure' | 'trim' | 'seam'

function roleMeshes(display: THREE.Object3D, role: TestGarmentRole) {
  const meshes: THREE.Mesh[] = []
  display.traverse(child => {
    if (child instanceof THREE.Mesh && child.userData.garmentRole === role) {
      meshes.push(child)
    }
  })
  return meshes
}

function hangerMeshes(display: THREE.Object3D) {
  const meshes: THREE.Mesh[] = []
  display.traverse(child => {
    if (
      child instanceof THREE.Mesh
      && child.userData.isGarmentHanger === true
    ) {
      meshes.push(child)
    }
  })
  return meshes
}

function contentBounds(object: THREE.Object3D) {
  object.updateWorldMatrix(true, true)
  const result = new THREE.Box3().makeEmpty()
  const childBounds = new THREE.Box3()
  object.traverse(child => {
    if (
      !(child instanceof THREE.Mesh)
      || child.userData.isGarmentHanger === true
    ) return
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
    if (!child.geometry.boundingBox) return
    childBounds.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld)
    result.union(childBounds)
  })
  return result
}

function garmentGroup(display: THREE.Group, position: GarmentPosition) {
  const model = garmentGroups(display).find(
    child => child.userData.garmentPosition === position,
  )
  assert.ok(model instanceof THREE.Group)
  return model
}

function garmentAnchorMesh(model: THREE.Object3D, anchor: 'hem' | 'waist') {
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
  assert.ok(match instanceof THREE.Mesh)
  return match
}

function detailMeshes(model: THREE.Object3D, detail: string) {
  const meshes: THREE.Mesh[] = []
  model.traverse(child => {
    if (
      child instanceof THREE.Mesh
      && child.userData.garmentDetail === detail
    ) {
      meshes.push(child)
    }
  })
  return meshes
}

function bodyPanel(model: THREE.Object3D, panel: string) {
  const matches = roleMeshes(model, 'body').filter(
    mesh => mesh.userData.garmentPanel === panel,
  )
  assert.equal(
    matches.length,
    1,
    `expected one ${panel} body panel, got ${matches.length}`,
  )
  return matches[0]!
}

function axisOverlap(
  first: THREE.Box3,
  second: THREE.Box3,
  axis: 'x' | 'y' | 'z',
) {
  return Math.min(first.max[axis], second.max[axis])
    - Math.max(first.min[axis], second.min[axis])
}

function xRangeNearBottom(mesh: THREE.Mesh, bottomFraction = 0.18) {
  mesh.updateWorldMatrix(true, false)
  mesh.geometry.computeBoundingBox()
  const geometryBounds = mesh.geometry.boundingBox
  assert.ok(geometryBounds)

  const cutoff =
    geometryBounds.min.y
    + (geometryBounds.max.y - geometryBounds.min.y) * bottomFraction
  const position = mesh.geometry.getAttribute('position')
  assert.ok(position)

  const point = new THREE.Vector3()
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (let index = 0; index < position.count; index += 1) {
    if (position.getY(index) > cutoff) continue
    point
      .set(
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      )
      .applyMatrix4(mesh.matrixWorld)
    min = Math.min(min, point.x)
    max = Math.max(max, point.x)
  }

  assert.ok(Number.isFinite(min) && Number.isFinite(max))
  return { min, max }
}

type DrapedSurfaceRow = {
  y: number
  width: number
  zSpan: number
}

function drapedSurfaceRows(
  mesh: THREE.Mesh,
  minimumHorizontalSamples = 7,
): DrapedSurfaceRow[] {
  const position = mesh.geometry.getAttribute('position')
  assert.ok(position)
  const rows = new Map<number, Map<number, number>>()

  for (let index = 0; index < position.count; index += 1) {
    const y = Number(position.getY(index).toFixed(4))
    const x = Number(position.getX(index).toFixed(4))
    const z = position.getZ(index)
    const row = rows.get(y) ?? new Map<number, number>()
    row.set(x, Math.max(row.get(x) ?? Number.NEGATIVE_INFINITY, z))
    rows.set(y, row)
  }

  return [...rows.entries()]
    .filter(([, row]) => row.size >= minimumHorizontalSamples)
    .map(([y, row]) => {
      const xs = [...row.keys()]
      const zs = [...row.values()]
      return {
        y,
        width: Math.max(...xs) - Math.min(...xs),
        zSpan: Math.max(...zs) - Math.min(...zs),
      }
    })
    .sort((first, second) => second.y - first.y)
}

function assertDrapedPanel(mesh: THREE.Mesh, label: string) {
  const rows = drapedSurfaceRows(mesh)
  assert.ok(
    rows.length >= 5,
    `${label} needs at least 5 subdivided surface rows; got ${rows.length}`,
  )

  const curvedRows = rows.filter(row => row.zSpan >= 0.018)
  assert.ok(
    curvedRows.length >= 4,
    `${label} needs Z undulation on at least 4 rows; got ${curvedRows.length}`,
  )

  const position = mesh.geometry.getAttribute('position')
  const normal = mesh.geometry.getAttribute('normal')
  const uv = mesh.geometry.getAttribute('uv')
  assert.ok(position && normal && uv)
  assert.equal(normal.count, position.count)
  assert.equal(uv.count, position.count)

  mesh.geometry.computeBoundingBox()
  const bounds = mesh.geometry.boundingBox
  assert.ok(bounds)
  assert.ok(
    bounds.max.z - bounds.min.z >= 0.1,
    `${label} depth is only ${bounds.max.z - bounds.min.z}`,
  )
  return rows
}

function roundedAxisLevels(
  mesh: THREE.Mesh,
  axis: 'x' | 'y' | 'z',
  digits = 4,
) {
  const position = mesh.geometry.getAttribute('position')
  assert.ok(position)
  const getter = axis === 'x'
    ? (index: number) => position.getX(index)
    : axis === 'y'
    ? (index: number) => position.getY(index)
    : (index: number) => position.getZ(index)
  const levels = new Set<number>()
  for (let index = 0; index < position.count; index += 1) {
    levels.add(Number(getter(index).toFixed(digits)))
  }
  return levels
}

function standardMaterials(mesh: THREE.Mesh) {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material]
  return materials.filter(
    (material): material is THREE.MeshStandardMaterial =>
      material instanceof THREE.MeshStandardMaterial,
  )
}

function colorDistance(first: THREE.Color, second: THREE.Color) {
  return Math.hypot(
    first.r - second.r,
    first.g - second.g,
    first.b - second.b,
  )
}

function assertLowContrastConstruction(
  model: THREE.Object3D,
  baseColor: string,
  label: string,
) {
  const structureMeshes = roleMeshes(model, 'structure')
  assert.ok(
    structureMeshes.length >= 2,
    `${label} must identify its finishing bands as structure`,
  )

  const base = new THREE.Color(baseColor)
  const paleReference = new THREE.Color('#f1eadf')
  const referenceSpan = colorDistance(base, paleReference)

  for (const role of ['structure', 'trim', 'seam'] as const) {
    for (const mesh of roleMeshes(model, role)) {
      for (const material of standardMaterials(mesh)) {
        const contrastRatio =
          colorDistance(base, material.color) / referenceSpan
        assert.ok(
          contrastRatio <= 0.1 + 1e-6,
          `${label} ${role} contrast is ${contrastRatio.toFixed(3)}`,
        )
      }
    }
  }
}

function createZoneSyncHarness({
  renderedZoneId,
  zoneOptions,
  devices,
  activeZoneIndex = 0,
  hasRestoredActiveZone = true,
  storedZoneLayouts = {},
  lamps = [
    {
      slotId: 'device-101',
      order: 0,
      lampX: -1,
      targetX: -1,
      sourceDeviceId: 101,
      isManual: false,
    },
    {
      slotId: 'manual-zone-a',
      order: 1,
      lampX: 1,
      targetX: 1,
      sourceDeviceId: '',
      isManual: true,
    },
  ],
}: {
  renderedZoneId: string
  zoneOptions: Array<{ zoneId: string; zoneName: string }>
  devices: Array<{ id: string | number }>
  activeZoneIndex?: number
  hasRestoredActiveZone?: boolean
  storedZoneLayouts?: Record<string, unknown>
  lamps?: Array<Record<string, unknown>>
}) {
  const syncActiveZoneIndex = sourceBlock(
    component,
    'function syncActiveZoneIndex()',
  )
  const syncActiveZoneLampCount = sourceBlock(
    component,
    'function syncActiveZoneLampCount()',
  )
  const saveActiveZoneLayout = sourceBlock(
    component,
    'function saveActiveZoneLayout()',
  )
  const state = {
    zoneOptions,
    devices,
    renderedZoneId,
    activeZoneIndex,
    rebuildCount: 0,
    clearSelectionCount: 0,
    stored: {
      version: 1,
      activeZoneId: renderedZoneId,
      zoneLayouts: storedZoneLayouts,
    },
    track: { startX: -3.2, endX: 3.2, y: 3.35, z: -1.05 },
    lamps,
    hasRestoredActiveZone,
  }

  const createHarness = new Function(
    'state',
    `
    const zoneOptions = { get value() { return state.zoneOptions } }
    const zoneCount = { get value() { return zoneOptions.value.length } }
    const activeZoneIndex = { value: state.activeZoneIndex }
    const activeZone = {
      get value() {
        return zoneOptions.value[activeZoneIndex.value] || createDefaultZoneOption()
      },
    }
    const layoutState = { track: state.track, lamps: state.lamps }
    const localStorage = { setItem() {} }
    const ZONE_LAYOUT_STORAGE_KEY = 'SMART_LIGHT_THREE_ZONE_LAYOUTS_V1'
    let hasRestoredActiveZone = state.hasRestoredActiveZone
    let renderedZoneId = state.renderedZoneId
    let cachedStoredLayouts = state.stored

    function createDefaultZoneOption() {
      return { zoneId: 'default-zone', zoneName: '默认展示区' }
    }
    function getStoredLayouts() { return state.stored }
    function getLampDevicesForZone() { return state.devices }
    function getDeviceId(device) { return device?.id ?? '' }
    function clearSelectedSlot() { state.clearSelectionCount += 1 }
    function rebuildActiveZoneLayout() { state.rebuildCount += 1 }
    function clamp(value, min, max) { return Math.min(Math.max(value, min), max) }
    function round(value) { return Math.round(value * 100) / 100 }
    function isSlotVisible(slot) {
      return Boolean(slot.isManual || slot.boundLampDeviceId || slot.sourceDeviceId)
    }

    ${saveActiveZoneLayout}
    ${syncActiveZoneIndex}
    ${syncActiveZoneLampCount}

    return {
      runDeviceUpdate() {
        syncActiveZoneIndex()
        syncActiveZoneLampCount()
        state.activeZoneIndex = activeZoneIndex.value
      },
    }
  `,
  ) as (state: typeof state) => { runDeviceUpdate: () => void }

  return { state, ...createHarness(state) }
}

describe('ThreeLightingLayout clothing-store scene contract', () => {
  it('publishes the shared display metrics and marks every garment hanger', () => {
    const metrics = (
      garmentModelLifecycle as typeof garmentModelLifecycle & {
        GARMENT_DISPLAY_METRICS?: Record<string, number>
      }
    ).GARMENT_DISPLAY_METRICS

    assert.deepEqual(metrics, {
      baseY: 0.72,
      railWorldY: 1.98,
      plinthTopWorldY: 0.448,
      clearance: 0.06,
      localMinY: -0.212,
      localRailY: 1.26,
      targetOverlap: 0.025,
      minOverlap: 0.015,
      maxOverlap: 0.05,
    })

    for (const factory of [
      createUpperGarment,
      createPantsGarment,
      createSkirtGarment,
      createDressGarment,
    ]) {
      const model = factory('#7b8794', createFabricMaterial)
      assert.equal(hangerMeshes(model).length, 1)
      disposeGarmentDisplay(model)
    }
  })

  it('exports four procedural garment factories and the display lifecycle', () => {
    const cases = [
      [createUpperGarment, '#d45a48', 'upper'],
      [createPantsGarment, '#315f9f', 'lower'],
      [createSkirtGarment, '#6f4e7c', 'lower'],
      [createDressGarment, '#2e8b78', 'fullBody'],
    ] as const

    for (const [factory, color, position] of cases) {
      const model = factory(color, createFabricMaterial)
      assert.ok(model instanceof THREE.Group)
      assert.equal(model.userData.garmentPosition, position)
      assert.ok(bodyMeshes(model).length >= 1)
      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          assert.equal(child.castShadow, true)
          assert.equal(child.userData.ownsGarmentGeometry, true)
        }
      })
      disposeGarmentDisplay(model)
    }
  })

  it('preserves the accepted upper silhouette while adding restrained body volume', () => {
    const upper = createUpperGarment('#315f9f', createFabricMaterial)
    try {
      const bodies = roleMeshes(upper, 'body')
      assert.equal(bodies.length, 1)
      assert.equal(roleMeshes(upper, 'trim').length, 4)
      assert.equal(roleMeshes(upper, 'seam').length, 2)
      assert.equal(roleMeshes(upper, 'structure').length, 0)

      const body = bodies[0]!
      body.geometry.computeBoundingBox()
      assert.ok(
        body.geometry.getAttribute('position').count > 7000,
        'upper body surface was not subdivided before shaping',
      )
      const bounds = body.geometry.boundingBox!
      assert.deepEqual(
        [bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y]
          .map(value => Number(value.toFixed(4))),
        [-0.7683, -0.0113, 0.758, 1.0335],
      )
      assert.ok(
        bounds.max.z - bounds.min.z >= 0.11,
        `upper body depth is only ${bounds.max.z - bounds.min.z}`,
      )
      assert.ok(
        roundedAxisLevels(body, 'z').size >= 18,
        'upper body still has too few depth levels to show fabric undulation',
      )
    } finally {
      disposeGarmentDisplay(upper)
    }
  })

  it('forms trousers from two waist-to-hem panels without a detached shorts shell', () => {
    const pants = createPantsGarment('#315f9f', createFabricMaterial)
    try {
      const leftLeg = bodyPanel(pants, 'left-trouser')
      const rightLeg = bodyPanel(pants, 'right-trouser')
      assert.equal(roleMeshes(pants, 'body').length, 2)
      assert.equal(
        roleMeshes(pants, 'body').filter(
          mesh => mesh.userData.garmentPanel === 'hip',
        ).length,
        0,
      )

      const leftBounds = contentBounds(leftLeg)
      const rightBounds = contentBounds(rightLeg)
      const totalSize = contentBounds(pants).getSize(new THREE.Vector3())

      assert.ok(
        totalSize.y / totalSize.x >= 1.35,
        `pants aspect ratio is only ${(totalSize.y / totalSize.x).toFixed(3)}`,
      )
      for (const [label, leg, legBounds] of [
        ['left', leftLeg, leftBounds],
        ['right', rightLeg, rightBounds],
      ] as const) {
        assert.ok(
          legBounds.max.y >= 0.49 && legBounds.min.y <= -0.7,
          `${label} trouser panel does not run continuously from waist to hem`,
        )
        assert.ok(
          legBounds.max.y - legBounds.min.y >= 1.19,
          `${label} trouser panel is still too short`,
        )
        const rows = assertDrapedPanel(leg, `${label} trouser panel`)
        const widths = rows.map(row => row.width)
        assert.ok(
          Math.max(...widths) / Math.min(...widths) <= 1.7,
          `${label} trouser width changes too abruptly`,
        )
      }

      assert.ok(leftBounds.max.x >= -0.01)
      assert.ok(rightBounds.min.x <= 0.01)
      assert.ok(axisOverlap(leftBounds, rightBounds, 'z') >= 0.04)
      const leftHem = xRangeNearBottom(leftLeg)
      const rightHem = xRangeNearBottom(rightLeg)
      assert.ok(
        leftHem.max <= rightHem.min - 0.04,
        'pants legs are not visibly separated at the hems',
      )
    } finally {
      disposeGarmentDisplay(pants)
    }
  })

  it('models the skirt as a long subdivided draped shell instead of a flat trapezoid', () => {
    const skirt = createSkirtGarment('#6f4e7c', createFabricMaterial)
    try {
      const surface = bodyPanel(skirt, 'skirt')
      assert.equal(roleMeshes(skirt, 'body').length, 1)
      const rows = assertDrapedPanel(surface, 'skirt')
      const top = rows[0]!
      const bottom = rows[rows.length - 1]!
      const flare = bottom.width / top.width
      const size = contentBounds(surface).getSize(new THREE.Vector3())

      assert.ok(size.y > size.x, `skirt is still too squat: ${size.y / size.x}`)
      assert.ok(flare >= 1.3, `skirt flare is only ${flare.toFixed(3)}`)
      assert.ok(flare <= 1.55, `skirt still reads as a triangle: ${flare.toFixed(3)}`)
    } finally {
      disposeGarmentDisplay(skirt)
    }
  })

  it('builds the dress as one continuous fitted-to-flared draped surface', () => {
    const dress = createDressGarment('#2e8b78', createFabricMaterial)
    try {
      const surface = bodyPanel(dress, 'dress')
      assert.equal(roleMeshes(dress, 'body').length, 1)
      const rows = assertDrapedPanel(surface, 'dress')
      const size = contentBounds(surface).getSize(new THREE.Vector3())
      const narrowestWidth = Math.min(...rows.map(row => row.width))
      const hemWidth = rows[rows.length - 1]!.width

      assert.ok(
        size.y / size.x >= 1.4,
        `dress aspect ratio is only ${(size.y / size.x).toFixed(3)}`,
      )
      assert.ok(
        hemWidth / narrowestWidth >= 1.75,
        'dress does not transition from a fitted waist into a fuller skirt',
      )
      assert.equal(roleMeshes(dress, 'trim').length, 0)
    } finally {
      disposeGarmentDisplay(dress)
    }
  })

  it('uses restrained structure contrast on every new garment model', () => {
    const cases = [
      ['pants', createPantsGarment, '#315f9f'],
      ['skirt', createSkirtGarment, '#6f4e7c'],
      ['dress', createDressGarment, '#2e2928'],
    ] as const

    for (const [label, factory, color] of cases) {
      const model = factory(color, createFabricMaterial)
      try {
        assertLowContrastConstruction(model, color, label)
      } finally {
        disposeGarmentDisplay(model)
      }
    }
  })

  it('preserves restrained structure contrast after same-signature recolouring', () => {
    const display = createGarmentDisplay(
      [garment('fullBody', 'dress', '#2e8b78')],
      createFabricMaterial,
    )

    try {
      updateGarmentDisplayColors(display, [
        garment('fullBody', 'dress', '#875634'),
      ])
      assertLowContrastConstruction(display, '#875634', 'recoloured dress')
    } finally {
      disposeGarmentDisplay(display)
    }
  })

  it('renders a lower-only outfit without synthesizing an upper garment', () => {
    const display = createGarmentDisplay(
      [garment('lower', 'pants', 'rgb(49, 95, 159)')],
      createFabricMaterial,
    )

    assert.deepEqual(
      garmentGroups(display).map(group => group.userData.garmentPosition),
      ['lower'],
    )
    assert.equal(display.userData.garmentSignature, 'lower:pants')
    disposeGarmentDisplay(display)
  })

  it('keeps separate upper and skirt colours in a two-piece display', () => {
    const display = createGarmentDisplay(
      [
        garment('upper', 'upper', 'rgb(212, 90, 72)'),
        garment('lower', 'skirt', 'rgb(62, 116, 168)'),
      ],
      createFabricMaterial,
    )

    const bodyColors = new Map(
      bodyMeshes(display).map(mesh => [
        mesh.userData.garmentPosition,
        (mesh.material as THREE.MeshStandardMaterial).color.getHexString(),
      ]),
    )
    assert.equal(bodyColors.get('upper'), 'd45a48')
    assert.equal(bodyColors.get('lower'), '3e74a8')
    assert.equal(garmentGroups(display).length, 2)

    const geometryByPosition = new Map(
      bodyMeshes(display).map(mesh => [
        mesh.userData.garmentPosition,
        mesh.geometry,
      ]),
    )
    updateGarmentDisplayColors(display, [
      garment('upper', 'upper', 'rgb(44, 126, 168)'),
      garment('lower', 'skirt', 'rgb(135, 86, 52)'),
    ])

    for (const mesh of bodyMeshes(display)) {
      assert.strictEqual(
        mesh.geometry,
        geometryByPosition.get(mesh.userData.garmentPosition),
      )
    }
    const updatedColors = new Map(
      bodyMeshes(display).map(mesh => [
        mesh.userData.garmentPosition,
        (mesh.material as THREE.MeshStandardMaterial).color.getHexString(),
      ]),
    )
    assert.equal(updatedColors.get('upper'), '2c7ea8')
    assert.equal(updatedColors.get('lower'), '875634')
    disposeGarmentDisplay(display)
  })

  it('renders a dress as one full-body garment', () => {
    const display = createGarmentDisplay(
      [garment('fullBody', 'dress', 'rgb(46, 139, 120)')],
      createFabricMaterial,
    )

    assert.equal(garmentGroups(display).length, 1)
    assert.equal(
      garmentGroups(display)[0]?.userData.garmentPosition,
      'fullBody',
    )
    assert.equal(display.userData.garmentSignature, 'fullBody:dress')
    disposeGarmentDisplay(display)
  })

  it('hangs lower-only and dress displays above the plinth clearance line', () => {
    for (const garments of [
      [garment('lower', 'pants', '#315f9f')],
      [garment('lower', 'skirt', '#6f4e7c')],
      [garment('fullBody', 'dress', '#2e8b78')],
    ]) {
      const display = createGarmentDisplay(garments, createFabricMaterial)
      const bounds = contentBounds(display)
      assert.ok(
        bounds.min.y >= -0.212 - 1e-6,
        `${bounds.min.y} crosses the safe line`,
      )
      assert.ok(bounds.max.y <= 1.26 + 1e-6)
      disposeGarmentDisplay(display)
    }
  })

  it('connects two-piece outfits inside the safe band with one visible hanger', () => {
    for (const lowerCategory of ['pants', 'skirt'] as const) {
      const display = createGarmentDisplay(
        [
          garment('upper', 'upper', '#d45a48'),
          garment('lower', lowerCategory, '#315f9f'),
        ],
        createFabricMaterial,
      )
      const upper = garmentGroup(display, 'upper')
      const lower = garmentGroup(display, 'lower')
      const upperHemBounds = contentBounds(garmentAnchorMesh(upper, 'hem'))
      const lowerWaistBounds = contentBounds(garmentAnchorMesh(lower, 'waist'))
      const overlap = lowerWaistBounds.max.y - upperHemBounds.min.y
      const displayBounds = contentBounds(display)

      assert.ok(
        overlap >= 0.015 - 1e-6,
        `${lowerCategory} leaves a waist gap`,
      )
      assert.ok(
        overlap <= 0.05 + 1e-6,
        `${lowerCategory} overlaps too far`,
      )
      assert.ok(displayBounds.min.y >= -0.212 - 1e-6)
      assert.ok(displayBounds.max.y <= 1.26 + 1e-6)
      assert.equal(hangerMeshes(upper)[0]?.visible, true)
      assert.equal(hangerMeshes(lower)[0]?.visible, false)
      const upperHangerPosition = new THREE.Vector3()
      hangerMeshes(upper)[0]?.getWorldPosition(upperHangerPosition)
      assert.ok(Math.abs(upperHangerPosition.y - 1.26) <= 1e-6)
      assert.equal(upper.scale.x, lower.scale.x)
      assert.equal(upper.scale.y, lower.scale.y)
      assert.equal(upper.scale.z, lower.scale.z)
      disposeGarmentDisplay(display)
    }
  })

  it('disposes the hidden lower hanger geometry with the outfit', () => {
    const display = createGarmentDisplay(
      [
        garment('upper', 'upper', '#d45a48'),
        garment('lower', 'pants', '#315f9f'),
      ],
      createFabricMaterial,
    )
    const lower = garmentGroup(display, 'lower')
    const lowerHanger = hangerMeshes(lower)[0]
    assert.ok(lowerHanger)
    assert.equal(lowerHanger.visible, false)
    let disposeCount = 0
    lowerHanger.geometry.dispose = () => {
      disposeCount += 1
    }

    disposeGarmentDisplay(display)

    assert.equal(disposeCount, 1)
  })

  it('updates same-signature colours without replacing body geometry', () => {
    const initial = [garment('upper', 'upper', 'rgb(212, 90, 72)')]
    const display = createGarmentDisplay(initial, createFabricMaterial)
    const body = bodyMeshes(display)[0]
    const geometry = body.geometry

    updateGarmentDisplayColors(display, [
      garment('upper', 'upper', 'rgb(44, 126, 168)'),
    ])

    assert.strictEqual(bodyMeshes(display)[0]?.geometry, geometry)
    assert.equal(
      (body.material as THREE.MeshStandardMaterial).color.getHexString(),
      '2c7ea8',
    )
    assert.equal(display.userData.garmentSignature, 'upper:upper')
    assert.deepEqual(display.userData.garmentColors, { upper: '#2c7ea8' })
    disposeGarmentDisplay(display)
  })

  it('disposes only display-owned garment materials and clears the display', () => {
    const display = createGarmentDisplay(
      [garment('upper', 'upper', 'rgb(212, 90, 72)')],
      createFabricMaterial,
    )
    const ownedMaterial = bodyMeshes(display)[0]?.material as THREE.Material
    const ownedGeometries = new Set<THREE.BufferGeometry>()
    display.traverse(child => {
      if (child instanceof THREE.Mesh) ownedGeometries.add(child.geometry)
    })
    const sharedMaterial = new THREE.MeshStandardMaterial({ color: '#9f875d' })
    const sharedGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)
    const sharedMesh = new THREE.Mesh(sharedGeometry, sharedMaterial)
    let ownedDisposeCount = 0
    let ownedGeometryDisposeCount = 0
    let sharedDisposeCount = 0
    let sharedGeometryDisposeCount = 0
    ownedMaterial.dispose = () => {
      ownedDisposeCount += 1
    }
    for (const geometry of ownedGeometries) {
      geometry.dispose = () => {
        ownedGeometryDisposeCount += 1
      }
    }
    sharedMaterial.dispose = () => {
      sharedDisposeCount += 1
    }
    sharedGeometry.dispose = () => {
      sharedGeometryDisposeCount += 1
    }
    display.add(sharedMesh)

    disposeGarmentDisplay(display)

    assert.equal(ownedDisposeCount, 1)
    assert.equal(ownedGeometryDisposeCount, ownedGeometries.size)
    assert.equal(sharedDisposeCount, 0)
    assert.equal(sharedGeometryDisposeCount, 0)
    assert.equal(display.children.length, 0)
    sharedMaterial.dispose()
  })

  it('releases every owned partial resource when garment material creation fails', () => {
    const expectedError = new Error(
      'material factory failed on the third garment mesh',
    )
    const releasedMaterials: THREE.Material[] = []
    const disposedMaterials: THREE.Material[] = []
    let materialCallCount = 0
    let geometryDisposeCount = 0
    const originalGeometryDispose = THREE.BufferGeometry.prototype.dispose

    THREE.BufferGeometry.prototype.dispose = function disposeTrackedGeometry() {
      geometryDisposeCount += 1
    }

    try {
      let thrown: unknown
      try {
        createGarmentDisplay(
          [garment('upper', 'upper', 'rgb(212, 90, 72)')],
          color => {
            materialCallCount += 1
            if (materialCallCount === 3) throw expectedError

            const material = new THREE.MeshStandardMaterial({ color })
            material.userData.releaseGarmentMaterial = () => {
              releasedMaterials.push(material)
              return true
            }
            material.dispose = () => {
              disposedMaterials.push(material)
            }
            return material
          },
        )
      } catch (error) {
        thrown = error
      }

      assert.strictEqual(thrown, expectedError)
      assert.equal(materialCallCount, 3)
      assert.equal(
        geometryDisposeCount,
        4,
        'expected the tessellation source plus every partial owned geometry to be released',
      )
      assert.equal(releasedMaterials.length, 2)
      assert.equal(new Set(releasedMaterials).size, 2)
      assert.equal(disposedMaterials.length, 0)
    } finally {
      THREE.BufferGeometry.prototype.dispose = originalGeometryDispose
    }
  })

  it('keeps the old scene display alive when an atomic garment replacement fails', () => {
    const atomicSync = (
      garmentModelLifecycle as typeof garmentModelLifecycle & {
        syncGarmentDisplayInScene?: (
          scene: THREE.Scene,
          owner: { garmentDisplay: THREE.Group },
          garments: GarmentPart[],
          expectedSignature: string,
          createMaterial: typeof createFabricMaterial,
        ) => void
      }
    ).syncGarmentDisplayInScene
    assert.equal(typeof atomicSync, 'function')

    const scene = new THREE.Scene()
    let oldMaterialReleaseCount = 0
    const oldDisplay = createGarmentDisplay(
      [garment('upper', 'upper', 'rgb(212, 90, 72)')],
      color => {
        const material = new THREE.MeshStandardMaterial({ color })
        material.userData.releaseGarmentMaterial = () => {
          oldMaterialReleaseCount += 1
          return true
        }
        return material
      },
    )
    oldDisplay.position.set(1.25, -0.4, 0.75)
    oldDisplay.rotation.set(0.1, 0.2, 0.3)
    oldDisplay.scale.setScalar(1.4)
    const owner = { garmentDisplay: oldDisplay }
    scene.add(oldDisplay)

    let oldGeometryDisposeCount = 0
    oldDisplay.traverse(child => {
      if (
        child instanceof THREE.Mesh &&
        child.userData.ownsGarmentGeometry === true
      ) {
        child.geometry.dispose = () => {
          oldGeometryDisposeCount += 1
        }
      }
    })

    const expectedError = new Error('replacement material factory failed')
    let nextMaterialCallCount = 0
    let nextMaterialReleaseCount = 0
    let nextMaterialDisposeCount = 0
    let nextGeometryDisposeCount = 0
    const originalGeometryDispose = THREE.BufferGeometry.prototype.dispose
    THREE.BufferGeometry.prototype.dispose =
      function disposePartialReplacementGeometry() {
        nextGeometryDisposeCount += 1
      }

    try {
      let thrown: unknown
      try {
        atomicSync?.(
          scene,
          owner,
          [garment('lower', 'skirt', 'rgb(62, 116, 168)')],
          'lower:skirt',
          color => {
            nextMaterialCallCount += 1
            if (nextMaterialCallCount === 3) throw expectedError
            const material = new THREE.MeshStandardMaterial({ color })
            material.userData.releaseGarmentMaterial = () => {
              nextMaterialReleaseCount += 1
              return true
            }
            material.dispose = () => {
              nextMaterialDisposeCount += 1
            }
            return material
          },
        )
      } catch (error) {
        thrown = error
      }

      assert.strictEqual(thrown, expectedError)
      assert.strictEqual(owner.garmentDisplay, oldDisplay)
      assert.equal(scene.children.length, 1)
      assert.strictEqual(scene.children[0], oldDisplay)
      assert.equal(oldMaterialReleaseCount, 0)
      assert.equal(oldGeometryDisposeCount, 0)
      assert.equal(nextMaterialReleaseCount, 2)
      assert.equal(nextMaterialDisposeCount, 0)
      assert.equal(nextGeometryDisposeCount, 3)
    } finally {
      THREE.BufferGeometry.prototype.dispose = originalGeometryDispose
      disposeGarmentDisplay(oldDisplay)
    }
  })

  it('updates an equal-signature scene display without rebuilding its geometry', () => {
    const scene = new THREE.Scene()
    const oldDisplay = createGarmentDisplay(
      [garment('upper', 'upper', 'rgb(212, 90, 72)')],
      createFabricMaterial,
    )
    const oldBody = bodyMeshes(oldDisplay)[0]
    const oldGeometry = oldBody.geometry
    const owner = { garmentDisplay: oldDisplay }
    scene.add(oldDisplay)
    let replacementMaterialCallCount = 0

    garmentModelLifecycle.syncGarmentDisplayInScene(
      scene,
      owner,
      [garment('upper', 'upper', 'rgb(44, 126, 168)')],
      'upper:upper',
      color => {
        replacementMaterialCallCount += 1
        return new THREE.MeshStandardMaterial({ color })
      },
    )

    assert.strictEqual(owner.garmentDisplay, oldDisplay)
    assert.strictEqual(scene.children[0], oldDisplay)
    assert.strictEqual(
      bodyMeshes(owner.garmentDisplay)[0]?.geometry,
      oldGeometry,
    )
    assert.equal(
      (oldBody.material as THREE.MeshStandardMaterial).color.getHexString(),
      '2c7ea8',
    )
    assert.equal(replacementMaterialCallCount, 0)
    disposeGarmentDisplay(owner.garmentDisplay)
  })

  it('rebuilds garment geometry only when the category-position signature changes', () => {
    const oldMaterialReleaseCounts = new Map<THREE.Material, number>()
    const oldMaterialDisposeCounts = new Map<THREE.Material, number>()
    const oldDisplay = createGarmentDisplay(
      [garment('upper', 'upper', 'rgb(212, 90, 72)')],
      color => {
        const material = new THREE.MeshStandardMaterial({ color })
        oldMaterialReleaseCounts.set(material, 0)
        oldMaterialDisposeCounts.set(material, 0)
        material.userData.releaseGarmentMaterial = () => {
          oldMaterialReleaseCounts.set(
            material,
            (oldMaterialReleaseCounts.get(material) ?? 0) + 1,
          )
          return true
        }
        material.dispose = () => {
          oldMaterialDisposeCounts.set(
            material,
            (oldMaterialDisposeCounts.get(material) ?? 0) + 1,
          )
        }
        return material
      },
    )
    oldDisplay.position.set(1.25, -0.4, 0.75)
    oldDisplay.rotation.set(0.1, 0.2, 0.3)
    oldDisplay.scale.set(1.4, 1.2, 0.9)

    const expectedPosition = oldDisplay.position.toArray()
    const expectedQuaternion = oldDisplay.quaternion.toArray()
    const expectedScale = oldDisplay.scale.toArray()
    const oldGeometryDisposeCounts = new Map<THREE.BufferGeometry, number>()
    oldDisplay.traverse(child => {
      if (
        !(child instanceof THREE.Mesh) ||
        child.userData.ownsGarmentGeometry !== true
      )
        return
      oldGeometryDisposeCounts.set(child.geometry, 0)
      child.geometry.dispose = () => {
        oldGeometryDisposeCounts.set(
          child.geometry,
          (oldGeometryDisposeCounts.get(child.geometry) ?? 0) + 1,
        )
      }
    })

    const scene = new THREE.Scene()
    const owner = { garmentDisplay: oldDisplay }
    scene.add(oldDisplay)
    let replacementMaterialCallCount = 0

    garmentModelLifecycle.syncGarmentDisplayInScene(
      scene,
      owner,
      [garment('lower', 'pants', 'rgb(62, 116, 168)')],
      'lower:pants',
      color => {
        replacementMaterialCallCount += 1
        return new THREE.MeshStandardMaterial({ color })
      },
    )

    assert.notStrictEqual(owner.garmentDisplay, oldDisplay)
    assert.equal(scene.children.length, 1)
    assert.strictEqual(scene.children[0], owner.garmentDisplay)
    assert.equal(oldDisplay.parent, null)
    assert.equal(owner.garmentDisplay.userData.garmentSignature, 'lower:pants')
    assert.deepEqual(owner.garmentDisplay.position.toArray(), expectedPosition)
    assert.deepEqual(
      owner.garmentDisplay.quaternion.toArray(),
      expectedQuaternion,
    )
    assert.deepEqual(owner.garmentDisplay.scale.toArray(), expectedScale)
    assert.equal(
      replacementMaterialCallCount,
      roleMeshes(owner.garmentDisplay, 'body').length
        + roleMeshes(owner.garmentDisplay, 'structure').length
        + roleMeshes(owner.garmentDisplay, 'trim').length
        + roleMeshes(owner.garmentDisplay, 'seam').length,
    )
    assert.ok(
      [...oldGeometryDisposeCounts.values()].every(count => count === 1),
    )
    assert.ok(
      [...oldMaterialReleaseCounts.values()].every(count => count === 1),
    )
    assert.ok(
      [...oldMaterialDisposeCounts.values()].every(count => count === 0),
    )

    const sync = sourceBlock(component, 'function syncGarmentDisplay(')
    assert.match(sync, /syncGarmentDisplayInScene\(\s*scene,\s*objects,/)
    assert.doesNotMatch(component, /createShirt|updateShirtColor|\.shirt\b/)
    disposeGarmentDisplay(owner.garmentDisplay)
  })

  it('does not overwrite persisted manual slots before the first zone layout is rendered', () => {
    const persistedLayout = {
      track: { startX: -3, endX: 3, y: 3.2, z: -1 },
      slots: [{ slotId: 'manual-persisted', order: 0, isManual: true }],
    }
    const harness = createZoneSyncHarness({
      renderedZoneId: '',
      zoneOptions: [{ zoneId: 'device-zone-a', zoneName: 'A 区' }],
      devices: [{ id: 101 }],
      hasRestoredActiveZone: false,
      storedZoneLayouts: { 'device-zone-a': persistedLayout },
      lamps: [
        {
          slotId: 'mock-1',
          order: 0,
          lampX: 0,
          targetX: 0,
          isManual: false,
        },
      ],
    })

    harness.runDeviceUpdate()

    assert.deepEqual(
      harness.state.stored.zoneLayouts['device-zone-a'],
      persistedLayout,
    )
  })

  it('preserves the rendered zone by identity when device-derived zones reorder', () => {
    const harness = createZoneSyncHarness({
      renderedZoneId: 'device-zone-b',
      zoneOptions: [
        { zoneId: 'device-zone-b', zoneName: 'B 区' },
        { zoneId: 'device-zone-a', zoneName: 'A 区' },
      ],
      devices: [{ id: 101 }],
      activeZoneIndex: 1,
    })

    harness.runDeviceUpdate()

    assert.equal(harness.state.activeZoneIndex, 0)
    assert.equal(harness.state.rebuildCount, 0)
  })

  it('rebuilds the rendered layout when a derived device zone changes identity', () => {
    const harness = createZoneSyncHarness({
      renderedZoneId: 'device-zone-a',
      zoneOptions: [{ zoneId: 'device-zone-b', zoneName: 'B 区' }],
      devices: [{ id: 101 }],
    })

    harness.runDeviceUpdate()

    assert.equal(harness.state.rebuildCount, 1)
  })

  it('saves old manual slots under their rendered zone before switching derived zones', () => {
    const harness = createZoneSyncHarness({
      renderedZoneId: 'device-zone-a',
      zoneOptions: [{ zoneId: 'device-zone-b', zoneName: 'B 区' }],
      devices: [{ id: 202 }],
    })

    harness.runDeviceUpdate()

    assert.ok(harness.state.stored.zoneLayouts['device-zone-a'])
    assert.equal(harness.state.stored.zoneLayouts['device-zone-b'], undefined)
  })

  it('keeps the existing device-layout interaction anchors intact', () => {
    assert.match(
      component,
      /import\s*{[\s\S]*?ZONE_LAYOUT_STORAGE_KEY[\s\S]*?}\s*from '\.\.\/\.\.\/utils\/deviceZoneStorage'/,
    )
    assert.match(component, /function switchZone\(direction: -1 \| 1\)/)
    assert.match(component, /function addManualSlot\(\)/)
    assert.match(component, /function handleArrangeSlotsEvenly\(\)/)
    assert.match(component, /function handlePointerDown\(event: PointerEvent\)/)
    assert.match(component, /function toggleCameraView\(\)/)
    assert.match(component, /emit\('selection-change', value\)/)
    assert.match(component, /await locateDevice\(String\(lamp\.chipId\)\)/)
  })

  it('defines the boutique retail scene layers', () => {
    assert.match(
      component,
      /const STORE_SCENE_SIGNATURE = 'boutique-clothing-store'/,
    )
    assert.match(component, /function createBoutiqueFloor\(\)/)
    assert.match(component, /function createClothingDisplayWall\(\)/)
    assert.match(component, /function createWarmRetailLighting\(\)/)
  })

  it('uses shared garment metrics for the display base, rail, and plinth top', () => {
    assert.match(component, /GARMENT_DISPLAY_METRICS/)
    assert.match(
      component,
      /const garmentBaseY = GARMENT_DISPLAY_METRICS\.baseY/,
    )
    assert.match(
      component,
      /rail\.position\.set\(x, GARMENT_DISPLAY_METRICS\.railWorldY,/,
    )
    assert.match(
      component,
      /GARMENT_DISPLAY_METRICS\.plinthTopWorldY - 0\.018 \/ 2/,
    )
  })

  it('keeps boutique scene identity without obscuring device spot effects or blue controls', () => {
    assert.match(
      component,
      /scene\.userData\.signature = STORE_SCENE_SIGNATURE/,
    )
    assert.doesNotMatch(component, /RectAreaLightUniformsLib/)
    assert.doesNotMatch(component, /new THREE\.RectAreaLight/)
    assert.match(component, /\.view-toggle-btn\s*\{[^}]*color:\s*#2563eb/)
    assert.match(component, /\.slot-toolbar button\s*\{[^}]*color:\s*#2563eb/)
    assert.match(component, /\.zone-arrow-btn\s*\{[^}]*color:\s*#2563eb/)
    assert.doesNotMatch(component, /rgba\(200, 165, 108/)
    assert.doesNotMatch(component, /rgba\(218, 181, 119/)
  })

  it('keeps boutique captions removed while retaining luminaire material details', () => {
    assert.doesNotMatch(component, /class="scene-overlay"/)
    assert.doesNotMatch(component, /精品服装灯光/)
    assert.doesNotMatch(component, /轨道编排工作台/)
    assert.doesNotMatch(component, /\.scene-overlay/)
    assert.match(component, /const heatSink = new THREE\.Mesh/)
    assert.match(component, /const lensGlass = new THREE\.Mesh/)
    assert.match(component, /@media \(prefers-reduced-motion: reduce\)/)
  })

  it('increases visible device spotlight effects without changing brightness state', () => {
    const functionStart = component.indexOf(
      'function updateLampVisuals(lamp: LampLayout) {',
    )
    const functionEnd = component.indexOf(
      '\nfunction applyLampAim(',
      functionStart,
    )
    assert.ok(functionStart >= 0 && functionEnd > functionStart)

    const updateLampVisuals = component.slice(functionStart, functionEnd)
    assert.match(
      updateLampVisuals,
      /const intensity = 0\.7 \+ lamp\.brightness \/ 100 \* 10\.8/,
    )
    assert.match(
      updateLampVisuals,
      /const opacity = 0\.04 \+ lamp\.brightness \/ 100 \* 0\.12/,
    )
  })

  it('uses colour-managed PBR rendering and disposes shared resources', () => {
    assert.match(component, /RoomEnvironment/)
    assert.match(
      component,
      /scene\.environment = environmentRenderTarget\.texture\r?\n\s*scene\.environmentIntensity = 0\.25/,
    )
    assert.match(
      component,
      /renderer\.outputColorSpace = THREE\.SRGBColorSpace/,
    )
    assert.match(
      component,
      /renderer\.toneMapping = THREE\.ACESFilmicToneMapping/,
    )
    assert.match(component, /renderer\.toneMappingExposure = 0\.92/)
    assert.match(
      component,
      /renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 2\)\)/,
    )
    assert.match(
      component,
      /boutiqueMaterials \?\?= createBoutiqueMaterialLibrary\(\)/,
    )
    assert.match(component, /environmentRenderTarget\?\.dispose\(\)/)
    assert.match(component, /boutiqueMaterials\?\.dispose\(\)/)
  })

  it('builds a complete room with an emissive-only cove that cannot light products', () => {
    const displayWall = sourceBlock(
      component,
      'function createClothingDisplayWall()',
    )
    const retailLighting = sourceBlock(
      component,
      'function createWarmRetailLighting()',
    )
    const ceilingReveal = sourceBetween(
      displayWall,
      'const ceilingReveal = new THREE.Mesh(',
      'ceilingReveal.position',
    )

    assert.match(ceilingReveal, /boutiqueMaterials\.coveGlow/)
    assert.equal(countMatches(displayWall, /boutiqueMaterials\.coveGlow/), 1)
    assert.deepEqual(lightConstructors(displayWall), [])
    assert.deepEqual(lightConstructors(retailLighting), [
      'HemisphereLight',
      'DirectionalLight',
      'AmbientLight',
    ])
    assert.doesNotMatch(component, /new\s+THREE\.PointLight\s*\(/)
    assert.doesNotMatch(retailLighting, /\bcove\b/i)
    assert.doesNotMatch(component, /ARCHITECTURE_LIGHT_LAYER/)
    assert.doesNotMatch(component, /camera\.layers\.enable/)
    assert.doesNotMatch(component, /function enableArchitectureLight/)
    assert.doesNotMatch(component, /coveLight/)
    assert.match(component, /new THREE\.PlaneGeometry\(8\.84, 6\.02/)
    assert.doesNotMatch(
      component,
      /const boardGeometry = new THREE\.BoxGeometry/,
    )
  })

  it('restores room readability with a neutral non-shadow fill unrelated to the cove', () => {
    assert.match(
      component,
      /const neutralFill = new THREE\.AmbientLight\('#d8dcde', 0\.55\)/,
    )
    assert.match(component, /neutralFill\.castShadow = false/)
    assert.match(component, /scene\.add\(ambient, key, neutralFill\)/)
  })

  it('delegates owned material cleanup so shared instances are not disposed by scene traversal', () => {
    assert.match(component, /boutiqueMaterials\?\.releaseMaterial\(material\)/)
    assert.match(component, /boutiqueMaterials\?\.ownsMaterial\(material\)/)
    assert.match(
      component,
      /if \(boutiqueMaterials\?\.ownsMaterial\(material\)\) return/,
    )
  })

  it('deduplicates shared geometry and materials through one scene disposal helper', () => {
    assert.match(
      component,
      /disposedGeometries = new Set<THREE\.BufferGeometry>\(\)/,
    )
    assert.match(component, /disposedMaterials = new Set<THREE\.Material>\(\)/)
    assert.match(
      component,
      /if \(!disposedGeometries\.has\(child\.geometry\)\)/,
    )
    assert.match(
      component,
      /disposeMaterial\(child\.material, disposedMaterials\)/,
    )
    assert.match(component, /if \(disposedMaterials\.has\(material\)\) return/)
    assert.match(component, /disposedMaterials\.add\(material\)/)

    const cleanupStart = component.indexOf('function cleanupThreeScene() {')
    const cleanupEnd = component.indexOf(
      '\nfunction disposeMaterial(',
      cleanupStart,
    )
    assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart)
    const cleanup = component.slice(cleanupStart, cleanupEnd)
    assert.match(
      cleanup,
      /disposeObject\(scene, disposedGeometries, disposedMaterials\)/,
    )
    assert.doesNotMatch(cleanup, /scene\.traverse/)
  })

  it('keeps library-owned lamp materials across rebuilds and releases local resources', () => {
    const disposeLampObjects = sourceBlock(
      component,
      'function disposeLampObjects(',
    )
    const sync = sourceBlock(component, 'function syncLampObjectsWithState()')
    const cleanup = sourceBlock(component, 'function cleanupThreeScene()')
    const disposeMaterial = sourceBlock(component, 'function disposeMaterial(')
    const createTrack = sourceBlock(component, 'function createTrack()')
    const createLampObjects = sourceBlock(
      component,
      'function createLampObjects(',
    )
    const lampObjectsLoop =
      /for\s*\(\s*const\s+objects\s+of\s+lampObjects\.values\(\)\s*\)/

    assert.doesNotMatch(
      component,
      /sharedMountMaterial|sharedHingeMaterial|sharedDarkMetalMaterial|sharedRimMaterial|sharedLampMaterials/,
    )
    assert.match(createTrack, /materials\.darkMetal/)
    assert.match(createTrack, /materials\.champagneMetal/)
    assert.match(
      createLampObjects,
      /const mountMaterial = materials\.darkMetal/,
    )
    assert.match(
      createLampObjects,
      /const rimMaterial = materials\.champagneMetal/,
    )
    assert.equal(
      countMatches(disposeLampObjects, /objects\.spot\.dispose\(\)/),
      1,
    )

    assert.equal(countMatches(sync, lampObjectsLoop), 1)
    const rebuildDisposalLoop = sourceBlock(
      sync,
      'for (const objects of lampObjects.values())',
    )
    assert.equal(countMatches(rebuildDisposalLoop, /scene\.remove\(/), 1)
    assert.equal(countMatches(rebuildDisposalLoop, /disposeLampObjects\(/), 1)
    assert.ok(
      rebuildDisposalLoop.indexOf('disposeLampObjects(') >
        rebuildDisposalLoop.indexOf('scene.remove('),
      'expected old scene objects to be removed before their resources are disposed',
    )
    assert.equal(countMatches(sync, /disposeLampObjects\(/), 1)
    assert.doesNotMatch(sync, /sharedLampMaterials/)

    assert.equal(countMatches(cleanup, lampObjectsLoop), 1)
    const cleanupDisposalLoop = sourceBlock(
      cleanup,
      'for (const objects of lampObjects.values())',
    )
    assert.equal(countMatches(cleanupDisposalLoop, /disposeLampObjects\(/), 1)
    assert.equal(countMatches(cleanup, /disposeLampObjects\(/), 1)

    assert.equal(countMatches(cleanup, /boutiqueMaterials\?\.dispose\(\)/), 1)
    assert.match(
      disposeMaterial,
      /if \(boutiqueMaterials\?\.ownsMaterial\(material\)\) return/,
    )
  })

  it('uses the boutique material library for the track and detailed luminaires', () => {
    const requireMaterials = sourceBlock(
      component,
      'function requireBoutiqueMaterials()',
    )
    const createTrack = sourceBlock(component, 'function createTrack()')
    const createLampObjects = sourceBlock(
      component,
      'function createLampObjects(',
    )

    assert.match(
      requireMaterials,
      /boutiqueMaterials \?\?= createBoutiqueMaterialLibrary\(\)/,
    )
    assert.match(createTrack, /const materials = requireBoutiqueMaterials\(\)/)
    assert.match(
      createTrack,
      /new THREE\.BoxGeometry\(1, 0\.1, 0\.18\), materials\.darkMetal/,
    )
    assert.match(
      createTrack,
      /new THREE\.BoxGeometry\(1, 0\.014, 0\.028\), materials\.champagneMetal/,
    )
    assert.match(
      createLampObjects,
      /const materials = requireBoutiqueMaterials\(\)/,
    )
    assert.match(
      createLampObjects,
      /const heatSinkFinMaterial = materials\.darkMetal/,
    )
    assert.match(createLampObjects, /const reflectorCup = new THREE\.Mesh/)
    assert.match(
      createLampObjects,
      /reflectorCup\.userData\.ignorePickable = true/,
    )
    assert.match(
      createLampObjects,
      /const lensMaterial = materials\.opticalGlass\.clone\(\)/,
    )
    assert.match(
      createLampObjects,
      /lensGlass\.userData\.ignorePickable = true/,
    )

    assert.match(
      createTrack,
      /const handleMaterial = new THREE\.MeshStandardMaterial\(\{ color: '#2563eb'/,
    )
    assert.match(
      createTrack,
      /leftHandleMesh\.userData\.dragType = 'track-left'/,
    )
    assert.match(
      createTrack,
      /rightHandleMesh\.userData\.dragType = 'track-right'/,
    )
    assert.match(
      createTrack,
      /pickableObjects\.push\(leftHandleMesh, rightHandleMesh\)/,
    )
    assert.match(createLampObjects, /group\.userData\.dragType = 'lamp'/)
    assert.match(createLampObjects, /markLampPickable\(group, lamp\.slotId\)/)
  })

  it('uses the boutique fabric factory for garment materials and releases them once', () => {
    const createLampObjects = sourceBlock(
      component,
      'function createLampObjects(',
    )
    const materialFactory = sourceBlock(
      component,
      'function createOwnedGarmentMaterial(',
    )
    const disposeLampObjects = sourceBlock(
      component,
      'function disposeLampObjects(',
    )

    assert.match(
      createLampObjects,
      /createGarmentDisplay\([\s\S]*lamp\.garments,[\s\S]*createOwnedGarmentMaterial/,
    )
    assert.match(materialFactory, /materials\.createFabricMaterial\(color\)/)
    assert.match(materialFactory, /materials\.releaseMaterial\(material\)/)
    assert.equal(
      countMatches(
        disposeLampObjects,
        /disposeGarmentDisplay\(objects\.garmentDisplay\)/,
      ),
      1,
    )
    assert.doesNotMatch(
      disposeLampObjects,
      /disposeObject\(objects\.garmentDisplay/,
    )
  })

  it('uses restrained camera materials and keeps decorative meshes non-interactive', () => {
    const createCameraNode = sourceBlock(
      component,
      'function createCameraNode()',
    )

    assert.match(
      createCameraNode,
      /const materials = requireBoutiqueMaterials\(\)/,
    )
    assert.match(createCameraNode, /materials\.cameraShell/)
    assert.match(
      createCameraNode,
      /const lensMaterial = materials\.opticalGlass\.clone\(\)/,
    )
    assert.match(createCameraNode, /lensMaterial\.emissiveIntensity = 0\.08/)
    assert.match(createCameraNode, /materials\.darkMetal/)
    assert.match(createCameraNode, /const statusLight = new THREE\.Mesh/)
    assert.match(
      createCameraNode,
      /statusLight\.userData\.ignorePickable = true/,
    )
    assert.match(createCameraNode, /lens\.userData\.ignorePickable = true/)
  })

  it('recomputes the real-device shadow budget for creation, rebuild, selection, order and binding changes', () => {
    const createMockLamps = sourceBlock(component, 'function createMockLamps()')
    const sync = sourceBlock(component, 'function syncLampObjectsWithState()')
    const selectSlot = sourceBlock(component, 'function selectSlot(')
    const clearSelectedSlot = sourceBlock(
      component,
      'function clearSelectedSlot()',
    )
    const applySlotOrderLayout = sourceBlock(
      component,
      'function applySlotOrderLayout()',
    )
    const syncDevicesToLayout = sourceBlock(
      component,
      'function syncDevicesToLayout()',
    )
    const updateSpotShadowBudget = sourceBlock(
      component,
      'function updateSpotShadowBudget()',
    )
    const createLampObjects = sourceBlock(
      component,
      'function createLampObjects(',
    )

    assert.match(createMockLamps, /if \(!isSlotVisible\(lamp\)\) continue/)
    assert.match(createMockLamps, /updateSpotShadowBudget\(\)/)
    assert.match(sync, /updateSpotShadowBudget\(\)/)
    assert.match(selectSlot, /updateSpotShadowBudget\(\)/)
    assert.match(clearSelectedSlot, /updateSpotShadowBudget\(\)/)
    assert.match(applySlotOrderLayout, /updateSpotShadowBudget\(\)/)
    assert.match(syncDevicesToLayout, /updateSpotShadowBudget\(\)/)
    assert.match(
      updateSpotShadowBudget,
      /selectSpotShadowSlotIds\(layoutState\.lamps, selectedSlotId\.value\)/,
    )
    assert.match(
      updateSpotShadowBudget,
      /objects\.spot\.castShadow = shadowIds\.has\(slotId\)/,
    )
    assert.doesNotMatch(createLampObjects, /spot\.castShadow = true/)
  })

  it('uses a neutral warm room backdrop without changing fog depth', () => {
    assert.match(component, /scene\.background = new THREE\.Color\('#b7b1aa'\)/)
    assert.match(component, /scene\.fog = new THREE\.Fog\('#b7b1aa', 7, 16\)/)
    assert.doesNotMatch(component, /#eef4fb/)
  })

  it('starts coordinated local texture loading after fallback scene creation', () => {
    assert.match(component, /loadBoutiqueTextures,/)
    assert.match(component, /createBoutiqueTextureLoadCoordinator,/)
    assert.match(
      component,
      /let boutiqueTextureLoadCoordinator: BoutiqueTextureLoadCoordinator \| null = null/,
    )
    assert.doesNotMatch(component, /textureLoadGeneration/)

    const init = sourceBlock(component, 'function initThreeScene()')
    const textureLoad = init.indexOf('startBoutiqueTextureLoad(renderer)')
    assert.ok(textureLoad > init.indexOf('createStoreSpace()'))
    assert.ok(textureLoad > init.indexOf('createTrack()'))
    assert.ok(textureLoad > init.indexOf('createMockLamps()'))
    assert.ok(textureLoad > init.indexOf('createCameraNode()'))

    const textureLoadHelper = sourceBlock(
      component,
      'function startBoutiqueTextureLoad(',
    )
    assert.match(
      textureLoadHelper,
      /loader: \(\) => loadBoutiqueTextures\(renderer\.capabilities\.getMaxAnisotropy\(\)\)/,
    )
    assert.match(textureLoadHelper, /getLibrary: \(\) => boutiqueMaterials/)
    assert.match(
      textureLoadHelper,
      /void boutiqueTextureLoadCoordinator\.start\(\)/,
    )

    const cleanup = sourceBlock(component, 'function cleanupThreeScene()')
    assert.match(
      cleanup,
      /function cleanupThreeScene\(\) \{\s*boutiqueTextureLoadCoordinator\?\.invalidate\(\)/,
    )
  })
})
