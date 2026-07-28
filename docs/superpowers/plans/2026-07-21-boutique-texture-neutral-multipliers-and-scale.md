# Boutique Texture Neutral Multipliers and Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render bundled colour and roughness maps with neutral material multipliers while enlarging the floor, plinth, and fabric texture features in the small 430 px-tall scene viewport.

**Architecture:** Keep the existing material colours and roughness values as pre-load or failure fallbacks. In `applyTextures`, switch colour-map consumers to white and roughness-map consumers to `1` only when the corresponding texture exists, restore fallbacks when it does not, and reduce only the approved repeat values. Restore the accepted dark oak and warm plaster albedo sources so the PNGs, rather than fallback multipliers, define their final colour.

**Tech Stack:** Three.js r185, TypeScript, Node.js test runner, PNG assets, Vite 8.

## Global Constraints

- Preserve fallback colours `#8b5a3c`, `#b8aea1`, `#c8bfb3`, and `#785039` before colour maps load or when they are missing.
- Use white as the colour multiplier only while the corresponding albedo map exists.
- Preserve fallback roughness values `0.3` and `0.38` before the metal roughness map loads or when it is missing.
- Use roughness `1` only while the metal roughness map exists.
- Change repeats only to floor `[2, 3]`, plinth `[1, 1]`, and fabric `[4, 4]`; keep wall, wall inset, and metal repeats unchanged.
- Do not change lighting, exposure, camera, device semantics, QA thresholds, colour-space configuration, or bump scales.
- Do not commit without explicit user authorization.

---

### Task 1: Specify neutral multipliers, fallback restoration, and approved repeats

**Files:**
- Modify: `tests/threeBoutiqueMaterials.test.ts`
- Test: `tests/threeBoutiqueMaterials.test.ts`

**Interfaces:**
- Consumes: `createBoutiqueMaterialLibrary()` and `applyTextures(textures)`
- Produces: regression coverage for material fallback state and mapped state

- [ ] **Step 1: Extend the fallback test**

Assert the initial floor, wall, wall inset, and plinth colours remain their existing fallback hex values, and the two metal roughness values remain `0.3` and `0.38`.

- [ ] **Step 2: Extend the mapped-material test**

Apply all six texture types and assert:

```ts
assert.equal(library.floor.color.getHexString(), 'ffffff')
assert.equal(library.wall.color.getHexString(), 'ffffff')
assert.equal(library.wallInset.color.getHexString(), 'ffffff')
assert.equal(library.plinthWood.color.getHexString(), 'ffffff')
assert.equal(library.champagneMetal.roughness, 1)
assert.equal(library.darkMetal.roughness, 1)
assert.deepEqual(library.floor.map?.repeat.toArray(), [2, 3])
assert.deepEqual(library.plinthWood.map?.repeat.toArray(), [1, 1])
assert.deepEqual(fabric.bumpMap?.repeat.toArray(), [4, 4])
```

- [ ] **Step 3: Assert fallback restoration**

Call `applyTextures({})` after the mapped assertions and verify the four fallback colours and two fallback roughness values return.

- [ ] **Step 4: Run the focused test and verify RED**

Run: `node --test tests/threeBoutiqueMaterials.test.ts`

Expected: failures show current tinted multipliers, current roughness factors, and old repeat values.

---

### Task 2: Implement mapped and fallback material state

**Files:**
- Modify: `src/components/device/threeBoutiqueMaterials.ts`
- Test: `tests/threeBoutiqueMaterials.test.ts`

**Interfaces:**
- Consumes: `BoutiqueTextureSet`
- Produces: deterministic material state for both present and absent maps

- [ ] **Step 1: Name fallback constants**

Define constants for the four fallback colours and two fallback roughness values, and use them in initial material construction.

- [ ] **Step 2: Switch colour multipliers with map presence**

After assigning colour maps, set each mapped material colour to white when its colour texture exists; otherwise restore its fallback colour.

- [ ] **Step 3: Switch roughness multipliers with map presence**

After assigning `brushedMetalRoughness`, set both metal roughness values to `1` when the map exists; otherwise restore `0.3` and `0.38`.

- [ ] **Step 4: Apply approved repeats**

Use floor `[2, 3]`, plinth `[1, 1]`, and fabric `[4, 4]`. Keep wall `[3, 2]`, wall inset `[2, 2]`, and metal `[6, 1]`.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/threeBoutiqueMaterials.test.ts`

Expected: all material tests pass.

---

### Task 3: Restore authored colour albedos and verify integration

**Files:**
- Replace: `src/assets/textures/boutique/smoked-oak-color.png`
- Replace: `src/assets/textures/boutique/mineral-plaster-color.png`
- Test: complete Three suite and production build

**Interfaces:**
- Consumes: original accepted image-generation outputs retained under the Codex generated-images directory
- Produces: 1024x1024 seamless colour albedos whose final colour is not pre-compensated for material tint

- [ ] **Step 1: Restore the original generated albedo content**

Downsample the retained smoked-oak and mineral-plaster source PNGs to 1024x1024 and apply the same centre-crop mirror tiling used by their aligned height maps. Do not apply the later brightness compensation transforms.

- [ ] **Step 2: Validate the two restored PNGs**

Verify each file is 1024x1024, larger than 16,000 bytes, opaque, and has matching opposite edges.

- [ ] **Step 3: Run the complete Three suite**

Run:

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeBoutiqueTextureLoadCoordinator.test.ts tests/threeSpotShadowBudget.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts tests/threeBoutiqueQaHarness.test.ts tests/threeBoutiqueQaMetrics.test.ts
```

Expected: `73/73` or the updated total passes.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: build passes with no missing-texture warnings; the existing large-chunk/plugin timing warnings may remain.

- [ ] **Step 5: Run two-viewport live QA**

Run: `node scripts/qa/threeBoutiqueSceneQa.mjs` against the local Vite server and inspect both screenshots. Confirm texture probes pass, the floor is readable without being classified as the red garment, garments retain colour and falloff, and no texture grid or seam is visible.
