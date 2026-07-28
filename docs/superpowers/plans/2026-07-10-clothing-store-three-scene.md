# 精品服装店 3D 场景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing 3D lighting view into a warm, premium clothing-store interior while preserving every device and layout interaction.

**Architecture:** Keep all changes inside the existing Vue component: scene helpers add procedural retail geometry and physical materials, while the current layout state remains the single source of truth for lamp position, aiming, brightness, temperature, and garment colour. A Node source-level contract test protects interaction anchors and validates the new scene/UI anchors without new runtime dependencies.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Three.js r185, scoped CSS, Node.js built-in test runner, Vite 8.

## Global Constraints

- Do not change props, emits, device selection, localStorage keys or shape, `locateDevice`, camera presets, or existing event handlers.
- Do not add packages, web requests, downloaded textures, static assets, or new component files.
- Build every texture procedurally with Three.js geometry, colour variation, and material properties.
- Preserve the `disposeObject` / `disposeMaterial` ownership model for all new scene meshes.
- Keep the 360px mobile viewport and ensure decorative overlays never intercept pointer events.

---

## File structure

- `src/components/device/ThreeLightingLayout.vue` — existing component API and interactions; gains procedural clothing-store helpers, refined lamp meshes, a decorative viewport overlay, and warm glass UI styles.
- `tests/threeLightingLayoutScene.test.ts` — Node test that protects interaction anchors and scene-presentation anchors.

### Task 1: Establish the non-regression and visual contract

**Files:**

- Create: `tests/threeLightingLayoutScene.test.ts`
- Modify: none
- Test: `tests/threeLightingLayoutScene.test.ts`

**Interfaces:**

- Consumes: `src/components/device/ThreeLightingLayout.vue` as UTF-8 text.
- Produces: `node --test tests/threeLightingLayoutScene.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/threeLightingLayoutScene.test.ts` with this complete content:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const component = readFileSync(
  new URL('../src/components/device/ThreeLightingLayout.vue', import.meta.url),
  'utf8',
)

describe('ThreeLightingLayout clothing-store scene contract', () => {
  it('keeps the existing device-layout interaction anchors intact', () => {
    assert.match(component, /const ZONE_LAYOUT_STORAGE_KEY = 'SMART_LIGHT_THREE_ZONE_LAYOUTS_V1'/)
    assert.match(component, /function switchZone\(direction: -1 \| 1\)/)
    assert.match(component, /function addManualSlot\(\)/)
    assert.match(component, /function handleArrangeSlotsEvenly\(\)/)
    assert.match(component, /function handlePointerDown\(event: PointerEvent\)/)
    assert.match(component, /function toggleCameraView\(\)/)
    assert.match(component, /emit\('selection-change', value\)/)
    assert.match(component, /await locateDevice\(String\(lamp\.chipId\)\)/)
  })

  it('defines the boutique retail scene layers', () => {
    assert.match(component, /const STORE_SCENE_SIGNATURE = 'boutique-clothing-store'/)
    assert.match(component, /function createBoutiqueFloor\(\)/)
    assert.match(component, /function createClothingDisplayWall\(\)/)
    assert.match(component, /function createWarmRetailLighting\(\)/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/threeLightingLayoutScene.test.ts`

Expected: the interaction test passes, while the boutique-layer test fails because its signature and scene helpers do not yet exist.

- [ ] **Step 3: Commit the red test**

```powershell
git add tests/threeLightingLayoutScene.test.ts
git commit -m "test: define clothing store scene contract"
```

### Task 2: Build the warm boutique interior from procedural materials

**Files:**

- Create: none
- Modify: `src/components/device/ThreeLightingLayout.vue: module constants and createStoreSpace section`
- Test: `tests/threeLightingLayoutScene.test.ts`

**Interfaces:**

- Consumes: module-scoped `scene`, `displayWallZ`, and `createStoreSpace(): void`.
- Produces: `STORE_SCENE_SIGNATURE`, `createBoutiqueFloor(): void`, `createClothingDisplayWall(): void`, and `createWarmRetailLighting(): void`.

- [ ] **Step 1: Add the named boutique palette and integrate it with the existing scene setup**

Add directly beneath `MIN_VISIBLE_SLOTS`:

```ts
const STORE_SCENE_SIGNATURE = 'boutique-clothing-store'
const boutiquePalette = {
  wall: '#d9d0c4',
  oak: '#b78559',
  champagne: '#c8a56c',
  charcoal: '#26313a',
  warmWhite: '#fff1d6',
} as const
```

Replace the old generic floor, wall-panel, and drawer construction in `createStoreSpace()` with these calls after its hemisphere light:

```ts
createBoutiqueFloor()
createClothingDisplayWall()
createWarmRetailLighting()
```

Do not change `createTrack()`, `createMockLamps()`, camera setup, pointer listeners, or the render loop.

- [ ] **Step 2: Add the floor helper**

Add this complete helper below `createStoreSpace()`:

```ts
function createBoutiqueFloor() {
  if (!scene) return

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 0.08, 6.1),
    new THREE.MeshStandardMaterial({ color: '#9b7253', roughness: 0.56, metalness: 0.02 }),
  )
  foundation.position.set(0, -0.04, 0.35)
  foundation.receiveShadow = true
  scene.add(foundation)

  const boardGeometry = new THREE.BoxGeometry(0.72, 0.012, 1.16)
  const boardColors = ['#c99769', boutiquePalette.oak, '#d1a275', '#aa7958']
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 11; column += 1) {
      const board = new THREE.Mesh(
        boardGeometry,
        new THREE.MeshStandardMaterial({
          color: boardColors[(row * 3 + column) % boardColors.length],
          roughness: 0.46,
          metalness: 0.01,
        }),
      )
      board.position.set(-3.58 + column * 0.716 + (row % 2 ? 0.18 : 0), 0.012, -1.4 + row * 1.14)
      board.receiveShadow = true
      scene.add(board)
    }
  }

  const sheen = new THREE.Mesh(
    new THREE.PlaneGeometry(7.7, 4.35),
    new THREE.MeshBasicMaterial({ color: boutiquePalette.warmWhite, transparent: true, opacity: 0.045, depthWrite: false }),
  )
  sheen.rotation.x = -Math.PI / 2
  sheen.position.set(0, 0.021, 0.42)
  scene.add(sheen)
}
```

- [ ] **Step 3: Add the clothing-display wall helper**

Add a helper that creates three wall bays at `x = -2.25, 0, 2.25`. Each bay must add: a `1.76 × 1.96` warm-grey inset panel at `displayWallZ + 0.035`, a four-sided `boutiquePalette.champagne` metal frame, a `1.32`-wide charcoal horizontal garment rail at `y = 1.98`, and a `1.48 × 0.18 × 0.31` display plinth at `y = 0.34`. Add a full `8.9 × 3.6 × 0.1` wall behind them with `roughness: 0.94`; all panels and plinths receive shadows, and plinths cast them.

- [ ] **Step 4: Add the warm retail-lighting helper**

Add a helper that adds exactly these scene lights, without touching per-device spotlights:

```ts
const key = new THREE.DirectionalLight('#fff1d6', 0.72)
key.position.set(-3.6, 4.6, 2.8)
key.castShadow = true
key.shadow.mapSize.set(1024, 1024)

const fill = new THREE.PointLight('#f6c88b', 0.58, 7, 2)
fill.position.set(2.9, 2.45, 1.25)

const wallWash = new THREE.RectAreaLight('#fff1d6', 3.4, 6.8, 1.1)
wallWash.position.set(0, 2.62, displayWallZ + 0.48)
wallWash.lookAt(0, 1.25, 0.35)
scene.add(key, fill, wallWash)
```

- [ ] **Step 5: Run the contract test to verify it passes**

Run: `node --test tests/threeLightingLayoutScene.test.ts`

Expected: both subtests pass; all scene helpers exist and the original interaction anchors remain unchanged.

- [ ] **Step 6: Commit the retail interior**

```powershell
git add src/components/device/ThreeLightingLayout.vue tests/threeLightingLayoutScene.test.ts
git commit -m "feat: build boutique clothing store scene"
```

### Task 3: Refine the luminaire, overlay, and warm glass control console

**Files:**

- Create: none
- Modify: `tests/threeLightingLayoutScene.test.ts`, `src/components/device/ThreeLightingLayout.vue: template, createLampObjects, scoped style`
- Test: `tests/threeLightingLayoutScene.test.ts`

**Interfaces:**

- Consumes: `createLampObjects(lamp: LampLayout): LampObjects`, existing template button bindings, and `updateLampVisuals(lamp: LampLayout): void`.
- Produces: decorative lamp meshes excluded from picking, an `aria-hidden` non-interactive overlay, and presentation CSS.

- [ ] **Step 1: Extend the test with failing presentation assertions**

Add this test inside the existing `describe` block:

```ts
  it('adds a non-interactive boutique overlay and luminaire material details', () => {
    assert.match(component, /class="scene-overlay" aria-hidden="true"/)
    assert.match(component, /\.scene-overlay\s*\{[\s\S]*pointer-events:\s*none/)
    assert.match(component, /const heatSink = new THREE\.Mesh/)
    assert.match(component, /const lensGlass = new THREE\.Mesh/)
    assert.match(component, /@media \(prefers-reduced-motion: reduce\)/)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/threeLightingLayoutScene.test.ts`

Expected: the first two subtests pass and the new presentation test fails.

- [ ] **Step 3: Add the viewport overlay without altering existing controls**

Within `.three-viewport-wrap`, directly after the current view-toggle button and before the existing viewport div, add:

```vue
<div class="scene-overlay" aria-hidden="true">
  <span>精品服装灯光</span>
  <small>拖动射灯调整陈列焦点</small>
</div>
```

- [ ] **Step 4: Add the two lamp detail anchors and exclude them from hit testing**

Within `createLampObjects()`, create `heatSink` using `new THREE.CylinderGeometry(0.205, 0.21, 0.16, 40)` and a dark-metal `MeshStandardMaterial`; position it at `(0, 0.17, 0)`. Create `lensGlass` with `new THREE.CylinderGeometry(0.187, 0.187, 0.022, 40)` and a transparent warm `MeshPhysicalMaterial`; position it at `(0, -0.388, 0)`. Add both to the existing `pitchBody.add(...)` call, set `lensGlass.userData.ignorePickable = true`, and preserve all existing aperture, ring, marker, beam, target, and drag behaviour.

- [ ] **Step 5: Add presentation styles**

Before the mobile media query, add a `.scene-overlay` rule with `position: absolute`, `left: 18px`, `bottom: 16px`, `z-index: 2`, `pointer-events: none`, warm white text, and text-shadow. Restyle only the existing visual classes `.three-controls-panel`, `.zone-switcher`, `.slot-toolbar`, `.slot-toolbar button`, `.zone-arrow-btn`, and `.view-toggle-btn` with a deep warm translucent background, champagne border, and `backdrop-filter: blur(16px) saturate(130%)`. Add this exact reduced-motion rule:

```css
@media (prefers-reduced-motion: reduce) {
  .view-toggle-btn,
  .slot-toolbar button,
  .zone-arrow-btn {
    transition: none;
  }
}
```

- [ ] **Step 6: Run all automated verification**

Run: `node --test tests/threeLightingLayoutScene.test.ts`

Expected: all three subtests pass.

Run: `npm run build`

Expected: `vue-tsc -b && vite build` exits with code 0.

- [ ] **Step 7: Manually verify preserved behavior**

Run: `npm run dev`. In the layout view, verify warm boutique wall and oak floor render; each lamp still targets its garment; lamp and track-handle dragging works; zone switching, add/delete/reorder, both camera modes, night mode, and a viewport at or below 768px retain current behavior.

- [ ] **Step 8: Commit the refined presentation**

```powershell
git add src/components/device/ThreeLightingLayout.vue tests/threeLightingLayoutScene.test.ts
git commit -m "feat: refine boutique lighting controls"
```
