# Garment Model and Layout Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the procedural pants, skirt, and dress models to match the accepted upper-garment quality, connect two-piece outfits at the waist, and keep every garment above the display plinth.

**Architecture:** Keep garment construction and display layout in `threeGarmentModels.ts`. Add explicit hanger metadata and shared scene metrics, then replace fixed two-piece offsets with geometry-bound measurements and a common outfit scale. `ThreeLightingLayout.vue` consumes the same metrics for the rail, plinth, and display base so the collision contract cannot drift.

**Tech Stack:** Vue 3, TypeScript, Three.js `Shape`/`ExtrudeGeometry`/`TubeGeometry`, Node test runner, Vite, Playwright QA harness.

## Global Constraints

- Preserve the existing upper-garment outline and construction details.
- Keep `createUpperGarment`, `createPantsGarment`, `createSkirtGarment`, `createDressGarment`, and `createGarmentDisplay` signatures unchanged.
- Keep dynamic upper/lower/full-body colour updates, garment signatures, ownership flags, material release callbacks, and atomic display replacement unchanged.
- Use world metrics exactly: display base `0.72`, rail `1.98`, plinth top `0.448`, clearance `0.06`, local safe minimum `-0.212`, local rail anchor `1.26`.
- Two-piece waist overlap after scaling must be between `0.015` and `0.05`, targeting `0.025` scene units.
- Do not add GLTF assets, dependencies, recognition categories, camera changes, light changes, or fabric-texture changes.
- The worktree already contains unrelated changes. Do not reset, overwrite, or commit unrelated hunks; leave implementation edits unstaged if an isolated commit would capture pre-existing work.

---

## File Map

- `src/components/device/threeGarmentModels.ts` — procedural garment geometry, hanger metadata, bounds measurement, single-garment alignment, and two-piece layout.
- `src/components/device/ThreeLightingLayout.vue` — consumes shared display metrics when placing garments, the rail, and the plinth top.
- `tests/threeLightingLayoutScene.test.ts` — geometry-detail, safe-bound, waist-overlap, hanger-visibility, scene-constant, colour, and lifecycle regressions.
- `scripts/qa/threeBoutiqueSceneQa.mjs` — existing browser QA runner; run unchanged for scene, console, texture, and performance regressions.

### Task 1: Add hanger metadata and adaptive garment layout

**Files:**
- Modify: `tests/threeLightingLayoutScene.test.ts:9-105, 215-288`
- Modify: `src/components/device/threeGarmentModels.ts:8-116, 386-455`

**Interfaces:**
- Consumes: existing garment factories and `THREE.Group` transforms.
- Produces: `GARMENT_DISPLAY_METRICS`, hanger meshes with `userData.isGarmentHanger === true`, and bounds-based transforms applied by `createGarmentDisplay`.

- [ ] **Step 1: Add test helpers for semantic meshes and transformed content bounds**

Add after `bodyMeshes` in `tests/threeLightingLayoutScene.test.ts`:

```ts
function roleMeshes(display: THREE.Object3D, role: 'body' | 'trim' | 'seam') {
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
    if (child instanceof THREE.Mesh && child.userData.isGarmentHanger === true) {
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
    if (!(child instanceof THREE.Mesh) || child.userData.isGarmentHanger === true) return
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
```

- [ ] **Step 2: Write the failing metrics and hanger test**

Add inside the clothing-store scene `describe`:

```ts
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
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```powershell
node --test tests/threeLightingLayoutScene.test.ts
```

Expected: FAIL because `GARMENT_DISPLAY_METRICS` is `undefined` and hangers are not marked.

- [ ] **Step 4: Add exact shared metrics and hanger metadata**

Add near the top of `threeGarmentModels.ts`:

```ts
export const GARMENT_DISPLAY_METRICS = {
  baseY: 0.72,
  railWorldY: 1.98,
  plinthTopWorldY: 0.448,
  clearance: 0.06,
  localMinY: -0.212,
  localRailY: 1.26,
  targetOverlap: 0.025,
  minOverlap: 0.015,
  maxOverlap: 0.05,
} as const
```

In `createHanger`, add:

```ts
hanger.userData.isGarmentHanger = true
```

- [ ] **Step 5: Run the test and verify the first contract is GREEN**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: PASS for the new metrics/hanger test; all pre-existing tests remain green.

- [ ] **Step 6: Write failing single- and two-piece layout tests**

Add:

```ts
it('hangs lower-only and dress displays above the plinth clearance line', () => {
  for (const garments of [
    [garment('lower', 'pants', '#315f9f')],
    [garment('lower', 'skirt', '#6f4e7c')],
    [garment('fullBody', 'dress', '#2e8b78')],
  ]) {
    const display = createGarmentDisplay(garments, createFabricMaterial)
    const bounds = contentBounds(display)
    assert.ok(bounds.min.y >= -0.212 - 1e-6, `${bounds.min.y} crosses the safe line`)
    disposeGarmentDisplay(display)
  }
})

it('connects two-piece outfits, fits the safe band, and hides the lower hanger', () => {
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
    const upperBounds = contentBounds(upper)
    const lowerBounds = contentBounds(lower)
    const overlap = lowerBounds.max.y - upperBounds.min.y
    const displayBounds = contentBounds(display)

    assert.ok(overlap >= 0.015 - 1e-6, `${lowerCategory} leaves a waist gap`)
    assert.ok(overlap <= 0.05 + 1e-6, `${lowerCategory} overlaps too far`)
    assert.ok(displayBounds.min.y >= -0.212 - 1e-6)
    assert.equal(hangerMeshes(upper)[0]?.visible, true)
    assert.equal(hangerMeshes(lower)[0]?.visible, false)
    assert.equal(upper.scale.x, lower.scale.x)
    assert.equal(upper.scale.y, lower.scale.y)
    assert.equal(upper.scale.z, lower.scale.z)
    disposeGarmentDisplay(display)
  }
})
```

- [ ] **Step 7: Run the tests and verify RED for layout behavior**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: FAIL because the dress crosses `-0.212`, two-piece outfits use fixed offsets, their waist gap is positive, and the lower hanger is visible.

- [ ] **Step 8: Implement bounds measurement and adaptive layout**

Add before `createGarmentDisplay` in `threeGarmentModels.ts`:

```ts
function findGarmentHanger(model: THREE.Group) {
  let hanger: THREE.Mesh | undefined
  model.traverse(child => {
    if (!hanger && child instanceof THREE.Mesh && child.userData.isGarmentHanger === true) {
      hanger = child
    }
  })
  return hanger
}

function measureGarmentContent(model: THREE.Object3D) {
  model.updateWorldMatrix(true, true)
  const bounds = new THREE.Box3().makeEmpty()
  const meshBounds = new THREE.Box3()
  model.traverse(child => {
    if (!(child instanceof THREE.Mesh) || child.userData.isGarmentHanger === true) return
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
    if (!child.geometry.boundingBox) return
    meshBounds.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld)
    bounds.union(meshBounds)
  })
  return bounds
}

function setGarmentScale(model: THREE.Group, scale: number) {
  model.scale.setScalar(THREE.MathUtils.clamp(scale, 0.01, 1))
}

function alignSingleGarmentToRail(model: THREE.Group) {
  const hanger = findGarmentHanger(model)
  if (!hanger) return
  const bounds = measureGarmentContent(model)
  const hangingSpan = hanger.position.y - bounds.min.y
  const availableHeight =
    GARMENT_DISPLAY_METRICS.localRailY - GARMENT_DISPLAY_METRICS.localMinY
  const scale = Math.min(1, availableHeight / Math.max(hangingSpan, 0.001))
  setGarmentScale(model, scale)
  model.position.y = GARMENT_DISPLAY_METRICS.localRailY - hanger.position.y * scale
}

function arrangeTwoPieceOutfit(upper: THREE.Group, lower: THREE.Group) {
  const upperHanger = findGarmentHanger(upper)
  const lowerHanger = findGarmentHanger(lower)
  if (!upperHanger) return

  const upperBounds = measureGarmentContent(upper)
  const lowerBounds = measureGarmentContent(lower)
  const upperHangDepth = upperHanger.position.y - upperBounds.min.y
  const lowerHeight = lowerBounds.max.y - lowerBounds.min.y
  const naturalHeight = upperHangDepth + lowerHeight
  const availableHeight =
    GARMENT_DISPLAY_METRICS.localRailY
    + GARMENT_DISPLAY_METRICS.targetOverlap
    - GARMENT_DISPLAY_METRICS.localMinY
  const scale = Math.min(1, availableHeight / Math.max(naturalHeight, 0.001))

  setGarmentScale(upper, scale)
  setGarmentScale(lower, scale)
  upper.position.y =
    GARMENT_DISPLAY_METRICS.localRailY - upperHanger.position.y * scale
  const upperBottom = upper.position.y + upperBounds.min.y * scale
  lower.position.y =
    upperBottom
    + GARMENT_DISPLAY_METRICS.targetOverlap
    - lowerBounds.max.y * scale
  lower.position.z = -0.008
  if (lowerHanger) lowerHanger.visible = false
}

function layoutGarmentModels(display: THREE.Group, hasUpper: boolean, hasLower: boolean) {
  const upper = display.children.find(
    child => child instanceof THREE.Group && child.userData.garmentPosition === 'upper',
  ) as THREE.Group | undefined
  const lower = display.children.find(
    child => child instanceof THREE.Group && child.userData.garmentPosition === 'lower',
  ) as THREE.Group | undefined
  const fullBody = display.children.find(
    child => child instanceof THREE.Group && child.userData.garmentPosition === 'fullBody',
  ) as THREE.Group | undefined

  if (hasUpper && hasLower && upper && lower) {
    arrangeTwoPieceOutfit(upper, lower)
    return
  }
  if (lower) alignSingleGarmentToRail(lower)
  if (fullBody) alignSingleGarmentToRail(fullBody)
}
```

Replace the fixed-offset loop in `createGarmentDisplay` with:

```ts
layoutGarmentModels(display, hasUpper, hasLower)
```

- [ ] **Step 9: Run layout tests and verify GREEN**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: all layout, colour, disposal, and swap tests PASS.

- [ ] **Step 10: Preserve the dirty-worktree boundary**

Run:

```powershell
git diff -- src/components/device/threeGarmentModels.ts tests/threeLightingLayoutScene.test.ts
```

Expected: only the metrics, hanger metadata, layout helpers, fixed-offset removal, and new tests appear in the relevant hunks. Do not commit if staging either path would include pre-existing unrelated changes.

### Task 2: Rebuild pants as one connected garment

**Files:**
- Modify: `tests/threeLightingLayoutScene.test.ts:215-288`
- Modify: `src/components/device/threeGarmentModels.ts:219-285`

**Interfaces:**
- Consumes: `createFabricMesh`, `createHanger`, `prepareGarmentGroup`.
- Produces: one connected pants body mesh plus waistband/hem trim and fly/crease seams; public factory signature remains unchanged.

- [ ] **Step 1: Write the failing pants-detail test**

Add:

```ts
it('builds pants as one connected silhouette with finished hems and seams', () => {
  const pants = createPantsGarment('#315f9f', createFabricMaterial)
  assert.equal(roleMeshes(pants, 'body').length, 1)
  assert.ok(roleMeshes(pants, 'trim').length >= 3)
  assert.ok(roleMeshes(pants, 'seam').length >= 5)
  const bounds = contentBounds(pants)
  assert.ok(bounds.min.x < -0.3 && bounds.max.x > 0.3)
  assert.ok(bounds.min.y < -0.4 && bounds.max.y > 0.4)
  disposeGarmentDisplay(pants)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: FAIL because pants currently have two body meshes, one trim, and no seam meshes.

- [ ] **Step 3: Replace the two trapezoid legs with a connected curved silhouette**

Replace `createPantLegShape` with:

```ts
function createPantsShape() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.38, 0.43)
  shape.quadraticCurveTo(0, 0.47, 0.38, 0.43)
  shape.bezierCurveTo(0.36, 0.25, 0.32, -0.12, 0.29, -0.43)
  shape.lineTo(0.075, -0.43)
  shape.bezierCurveTo(0.07, -0.23, 0.065, -0.02, 0.035, 0.08)
  shape.quadraticCurveTo(0, 0.015, -0.035, 0.08)
  shape.bezierCurveTo(-0.065, -0.02, -0.07, -0.23, -0.075, -0.43)
  shape.lineTo(-0.29, -0.43)
  shape.bezierCurveTo(-0.32, -0.12, -0.36, 0.25, -0.38, 0.43)
  shape.closePath()
  return shape
}
```

Inside `createPantsGarment`, replace the leg loop with this body construction and detailing:

```ts
const geometry = trackGeometry(
  resources,
  new THREE.ExtrudeGeometry(createPantsShape(), {
    depth: 0.055,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.005,
    bevelSegments: 2,
  }),
)
geometry.translate(0, 0, -0.0275)
const body = createFabricMesh(
  geometry,
  'lower',
  'body',
  normalizedColor,
  createFabricMaterial,
  resources,
)
pants.add(body)

const waistband = createFabricMesh(
  new THREE.BoxGeometry(0.76, 0.07, 0.075),
  'lower', 'trim', normalizedColor, createFabricMaterial, resources,
)
waistband.position.set(0, 0.445, 0.025)

for (const x of [-0.18, 0.18]) {
  const hem = createFabricMesh(
    new THREE.BoxGeometry(0.21, 0.018, 0.014),
    'lower', 'trim', normalizedColor, createFabricMaterial, resources,
  )
  hem.position.set(x, -0.415, 0.068)
  pants.add(hem)
}

const fly = createFabricMesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.39, 0.068),
    new THREE.Vector3(0.012, 0.26, 0.07),
    new THREE.Vector3(0, 0.12, 0.068),
  ]), 18, 0.006, 6, false),
  'lower', 'seam', normalizedColor, createFabricMaterial, resources,
)
pants.add(fly)

for (const x of [-0.17, 0.17]) {
  const crease = createFabricMesh(
    new THREE.BoxGeometry(0.008, 0.65, 0.01),
    'lower', 'seam', normalizedColor, createFabricMaterial, resources,
  )
  crease.position.set(x, -0.07, 0.068)
  crease.rotation.z = x < 0 ? -0.018 : 0.018
  pants.add(crease)
}

for (const side of [-1, 1] as const) {
  const sideSeam = createFabricMesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.365, 0.36, 0.064),
      new THREE.Vector3(side * 0.33, -0.04, 0.066),
      new THREE.Vector3(side * 0.285, -0.39, 0.066),
    ]), 24, 0.0055, 6, false),
    'lower', 'seam', normalizedColor, createFabricMaterial, resources,
  )
  pants.add(sideSeam)
}

pants.add(waistband, createHanger(0.62, 0.54, resources))
```

The shown `0.055` depth, `0.006` bevel size, `0.005` bevel thickness, and role-aware `createFabricMesh` calls preserve the ownership, shadow, colour, and cleanup conventions.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: the pants-detail test and all adaptive-layout tests PASS.

- [ ] **Step 5: Inspect only the pants-related diff hunks**

Run `git diff -- src/components/device/threeGarmentModels.ts tests/threeLightingLayoutScene.test.ts` and confirm no upper-garment outline coordinates changed.

### Task 3: Refine the skirt and dress silhouettes and construction details

**Files:**
- Modify: `tests/threeLightingLayoutScene.test.ts:215-310`
- Modify: `src/components/device/threeGarmentModels.ts:287-385`

**Interfaces:**
- Consumes: the adaptive layout from Task 1 and existing fabric mesh factory.
- Produces: curved skirt/dress bodies with at least three trim meshes and three seam/fold meshes where specified.

- [ ] **Step 1: Write failing skirt and dress detail tests**

Add:

```ts
it('gives the skirt a curved finished hem and restrained fold lines', () => {
  const skirt = createSkirtGarment('#6f4e7c', createFabricMaterial)
  assert.equal(roleMeshes(skirt, 'body').length, 1)
  assert.ok(roleMeshes(skirt, 'trim').length >= 2)
  assert.ok(roleMeshes(skirt, 'seam').length >= 3)
  disposeGarmentDisplay(skirt)
})

it('gives the dress a continuous bodice, waist, hem, and skirt folds', () => {
  const dress = createDressGarment('#2e8b78', createFabricMaterial)
  assert.equal(roleMeshes(dress, 'body').length, 1)
  assert.ok(roleMeshes(dress, 'trim').length >= 3)
  assert.ok(roleMeshes(dress, 'seam').length >= 3)
  const bounds = contentBounds(dress)
  assert.ok(bounds.max.y - bounds.min.y > 1.35)
  disposeGarmentDisplay(dress)
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: skirt fails the trim count; dress fails trim, seam, and construction-detail expectations.

- [ ] **Step 3: Replace the skirt outline and add a curved hem**

Use this skirt body shape:

```ts
const shape = new THREE.Shape()
shape.moveTo(-0.34, 0.43)
shape.quadraticCurveTo(0, 0.47, 0.34, 0.43)
shape.bezierCurveTo(0.37, 0.14, 0.49, -0.19, 0.57, -0.43)
shape.quadraticCurveTo(0, -0.5, -0.57, -0.43)
shape.bezierCurveTo(-0.49, -0.19, -0.37, 0.14, -0.34, 0.43)
shape.closePath()
```

Use the existing extrude options, then construct the waistband, curved hem, and three fold tubes exactly as follows:

```ts
const waistband = createFabricMesh(
  new THREE.BoxGeometry(0.72, 0.07, 0.075),
  'lower', 'trim', normalizedColor, createFabricMaterial, resources,
)
waistband.position.set(0, 0.445, 0.025)

const hem = createFabricMesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.54, -0.425, 0.068),
    new THREE.Vector3(-0.27, -0.455, 0.071),
    new THREE.Vector3(0, -0.468, 0.072),
    new THREE.Vector3(0.27, -0.455, 0.071),
    new THREE.Vector3(0.54, -0.425, 0.068),
  ]), 32, 0.007, 7, false),
  'lower', 'trim', normalizedColor, createFabricMaterial, resources,
)
skirt.add(body, waistband, hem)

for (const [topX, bottomX] of [
  [-0.22, -0.3],
  [0, 0],
  [0.22, 0.3],
] as const) {
  const fold = createFabricMesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(topX, 0.38, 0.068),
      new THREE.Vector3((topX + bottomX) / 2, -0.02, 0.071),
      new THREE.Vector3(bottomX, -0.41, 0.068),
    ]), 24, 0.0055, 6, false),
    'lower', 'seam', normalizedColor, createFabricMaterial, resources,
  )
  skirt.add(fold)
}
skirt.add(createHanger(0.62, 0.54, resources))
```

- [ ] **Step 4: Rebuild the dress outline and add waist, hem, and folds**

Use one continuous dress body shape:

```ts
const shape = new THREE.Shape()
shape.moveTo(-0.58, -0.59)
shape.bezierCurveTo(-0.48, -0.28, -0.35, -0.02, -0.28, 0.08)
shape.lineTo(-0.3, 0.47)
shape.quadraticCurveTo(-0.39, 0.51, -0.4, 0.58)
shape.quadraticCurveTo(-0.31, 0.73, -0.22, 0.8)
shape.quadraticCurveTo(-0.17, 0.84, -0.12, 0.82)
shape.quadraticCurveTo(0, 0.72, 0.12, 0.82)
shape.quadraticCurveTo(0.17, 0.84, 0.22, 0.8)
shape.quadraticCurveTo(0.31, 0.73, 0.4, 0.58)
shape.quadraticCurveTo(0.39, 0.51, 0.3, 0.47)
shape.lineTo(0.28, 0.08)
shape.bezierCurveTo(0.35, -0.02, 0.48, -0.28, 0.58, -0.59)
shape.quadraticCurveTo(0, -0.66, -0.58, -0.59)
shape.closePath()
```

Create the body with `depth: 0.058`, `bevelSize: 0.007`, `bevelThickness: 0.006`, and `bevelSegments: 2`, translate it by `-0.029` on Z, and then add:

```ts
const waist = createFabricMesh(
  new THREE.BoxGeometry(0.58, 0.018, 0.014),
  'fullBody', 'trim', normalizedColor, createFabricMaterial, resources,
)
waist.position.set(0, 0.085, 0.071)

const hem = createFabricMesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.55, -0.585, 0.069),
    new THREE.Vector3(0, -0.625, 0.073),
    new THREE.Vector3(0.55, -0.585, 0.069),
  ]), 32, 0.007, 7, false),
  'fullBody', 'trim', normalizedColor, createFabricMaterial, resources,
)

const collarCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.13, 0.81, 0.042),
  new THREE.Vector3(-0.06, 0.75, 0.048),
  new THREE.Vector3(0.06, 0.75, 0.048),
  new THREE.Vector3(0.13, 0.81, 0.042),
])
const collar = createFabricMesh(
  new THREE.TubeGeometry(collarCurve, 24, 0.008, 8, false),
  'fullBody', 'trim', normalizedColor, createFabricMaterial, resources,
)

dress.add(body, collar, waist, hem)
for (const x of [-0.18, 0, 0.18]) {
  const fold = createFabricMesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0.05, 0.068),
      new THREE.Vector3(x * 1.2, -0.24, 0.072),
      new THREE.Vector3(x * 1.45, -0.56, 0.07),
    ]), 24, 0.0055, 6, false),
    'fullBody', 'seam', normalizedColor, createFabricMaterial, resources,
  )
  dress.add(fold)
}
dress.add(createHanger(0.44, 0.91, resources))
```

- [ ] **Step 5: Run all garment tests and verify GREEN**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: all model-detail, safe-bound, overlap, colour, ownership, and lifecycle tests PASS.

- [ ] **Step 6: Re-measure every display variant from Node**

Run a one-off `node --input-type=module -e` measurement for upper-only, pants-only, skirt-only, upper+pants, upper+skirt, and dress. Expected local lower bounds are all `>= -0.212`; two-piece overlap is `0.015..0.05`; lower hangers are invisible.

### Task 4: Make scene placement consume the shared metrics

**Files:**
- Modify: `tests/threeLightingLayoutScene.test.ts:1010-1050`
- Modify: `src/components/device/ThreeLightingLayout.vue:236-245, 527-530, 1360-1390`

**Interfaces:**
- Consumes: `GARMENT_DISPLAY_METRICS` from Task 1.
- Produces: a single source of truth for display base, rail height, and plinth-top surface.

- [ ] **Step 1: Write the failing scene-source contract**

Add:

```ts
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
```

- [ ] **Step 2: Run the test and verify RED**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: FAIL because the component still contains numeric literals.

- [ ] **Step 3: Import and use the shared metrics without changing scene values**

Extend the garment-model import:

```ts
import {
  GARMENT_DISPLAY_METRICS,
  createGarmentDisplay,
  disposeGarmentDisplay,
  syncGarmentDisplayInScene,
} from './threeGarmentModels'
```

Change:

```ts
const garmentBaseY = GARMENT_DISPLAY_METRICS.baseY
```

Use:

```ts
rail.position.set(x, GARMENT_DISPLAY_METRICS.railWorldY, displayWallZ + 0.14)
```

and:

```ts
plinthTop.position.set(
  x,
  GARMENT_DISPLAY_METRICS.plinthTopWorldY - 0.018 / 2,
  displayWallZ + 0.2,
)
```

- [ ] **Step 4: Run the source and geometry tests and verify GREEN**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: all tests PASS with unchanged world placement values.

### Task 5: Full regression, visual QA, and review

**Files:**
- Verify: `src/components/device/threeGarmentModels.ts`
- Verify: `src/components/device/ThreeLightingLayout.vue`
- Verify: `tests/threeLightingLayoutScene.test.ts`
- Run unchanged: `scripts/qa/threeBoutiqueSceneQa.mjs`

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: verified production build and screenshots demonstrating model quality, waist connection, and plinth clearance.

- [ ] **Step 1: Run the Three.js regression suite**

Run:

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeBoutiqueTextureLoadCoordinator.test.ts tests/threeSpotShadowBudget.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts tests/threeBoutiqueQaHarness.test.ts tests/threeBoutiqueQaMetrics.test.ts
```

Expected: all tests PASS; no resource-disposal, texture, scene, toolbar, or QA-contract regression.

- [ ] **Step 2: Run the production build**

Run `npm run build`.

Expected: `vue-tsc -b` and `vite build` complete with exit code `0`.

- [ ] **Step 3: Start the local Vite server for QA**

Run `npm run dev -- --host 127.0.0.1 --port 5178` as a background process and wait until `http://127.0.0.1:5178` responds.

- [ ] **Step 4: Run the existing boutique QA harness**

Run:

```powershell
$env:THREE_QA_BASE_URL='http://127.0.0.1:5178/smartlightdashboard'
node scripts/qa/threeBoutiqueSceneQa.mjs
```

Expected: it writes `output/playwright/three-boutique-1920x1080.png`, `three-boutique-2560x1440.png`, and `three-boutique-qa.json`; functional checks pass or any hardware-only FPS ineligibility is reported separately from visual correctness.

- [ ] **Step 5: Capture dedicated garment scenarios**

Using Playwright route interception and the same auth/store localStorage setup as the QA harness, render three lamps with these payloads:

```ts
[
  {
    id: 201,
    chipId: 'garment-pants',
    displayName: '新品展示区',
    deviceType: 'lamp',
    garments: [
      { position: 'upper', category: 'upper', categoryConfidence: 0.98, fabric: 'cotton', mainColorRgb: '#8ba9c7', maskArea: 1200 },
      { position: 'lower', category: 'pants', categoryConfidence: 0.98, fabric: 'cotton', mainColorRgb: '#e6e8ea', maskArea: 1000 },
    ],
  },
  {
    id: 202,
    chipId: 'garment-skirt',
    displayName: '新品展示区',
    deviceType: 'lamp',
    garments: [
      { position: 'upper', category: 'upper', categoryConfidence: 0.98, fabric: 'cotton', mainColorRgb: '#202225', maskArea: 1200 },
      { position: 'lower', category: 'skirt', categoryConfidence: 0.98, fabric: 'wool', mainColorRgb: '#8f7358', maskArea: 1000 },
    ],
  },
  {
    id: 203,
    chipId: 'garment-dress',
    displayName: '新品展示区',
    deviceType: 'lamp',
    garments: [
      { position: 'fullBody', category: 'dress', categoryConfidence: 0.98, fabric: 'cotton', mainColorRgb: '#42464d', maskArea: 1800 },
    ],
  },
]
```

Capture the canvas at `1920x1080` and inspect the image at original resolution.

- [ ] **Step 6: Apply the visual acceptance checklist**

Confirm:

- pants read as one connected garment with a waist, crotch, two legs, hems, and front construction lines;
- skirt has a curved silhouette, finished hem, and restrained folds;
- dress has a recognizable bodice, neckline, waist, continuous skirt, hem, and folds;
- both two-piece outfits have a connected waist with no visible air gap;
- no garment, bevel, hanger, or shadow appears through the plinth top;
- dress hangs near the rail rather than sitting low in the panel;
- existing upper-only presentation remains visually unchanged;
- no console or page errors appear.

- [ ] **Step 7: Review the final diff and working-tree boundaries**

Run:

```powershell
git diff --check
git diff -- src/components/device/threeGarmentModels.ts src/components/device/ThreeLightingLayout.vue tests/threeLightingLayoutScene.test.ts
git status --short
```

Expected: no whitespace errors; only requested garment/layout hunks are new; all unrelated pre-existing files remain untouched. Do not stage or commit mixed files.
