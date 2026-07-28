# Neutral Fabric Detail Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the existing woven height PNG as a neutral colour-detail layer so garment weave remains visible under front-facing light without darkening runtime garment colours.

**Architecture:** Fabric materials share the same derived texture for `map` and `bumpMap`. A stable `onBeforeCompile` hook replaces standard map multiplication with grayscale detail centered around a multiplier of `1.0`.

**Tech Stack:** TypeScript, Three.js `MeshStandardMaterial`, GLSL shader chunks, Node test runner, Vue 3/Vite, Playwright.

## Global Constraints

- Do not modify `woven-fabric-height.png`.
- Do not change garment colours, lights, camera, renderer, geometry, or non-fabric materials.
- Use repeat `[0.75, 0.75]`, offset `[0, 0]`, and existing bump scale `0.012`.
- Use neutral detail formula `clamp(1.0 + (sample - 0.56) * 1.8, 0.65, 1.35)`.
- Do not commit.

---

### Task 1: Define the neutral fabric shader contract

**Files:**
- Modify: `tests/threeBoutiqueMaterials.test.ts`
- Modify: `src/components/device/threeBoutiqueMaterials.ts`

**Interfaces:**
- Consumes: `createFabricMaterial()` and `applyTextures()`.
- Produces: fabric materials with shared colour/bump detail texture and a stable shader customization.

- [ ] **Step 1: Write failing assertions**

Require existing and late-created fabrics to use the same texture for `map` and `bumpMap`, require the `[0.75, 0.75]` UV transform with zero offset, invoke `onBeforeCompile` with `#include <map_fragment>`, and assert the resulting shader contains the stronger neutral detail formula instead of `diffuseColor *= sampledDiffuseColor`.

- [ ] **Step 2: Verify RED**

Run `node --test tests/threeBoutiqueMaterials.test.ts`. Expect failure because fabric `map` is currently null and no shader customization exists.

- [ ] **Step 3: Implement the minimal shader customization**

Keep the focused `onBeforeCompile` and `customProgramCacheKey` helper. Assign `activeFabricHeight` to both `map` and `bumpMap`, set full-texture repeat/offset once on the shared derived texture, and clear both when textures disappear.

- [ ] **Step 4: Verify GREEN**

Run `node --test tests/threeBoutiqueMaterials.test.ts`. Expect all material tests to pass.

### Task 2: Regression and visual verification

**Files:**
- Verify: `output/playwright/three-boutique-fabric-neutral-detail.png`

**Interfaces:**
- Consumes: existing dashboard, QA fixtures, and close adjustment interaction.
- Produces: automated and visual evidence that the weave is visible and colours remain recognizable.

- [ ] **Step 1: Run all Three tests**

Run the seven-suite Three test command. Expect 74 tests and zero failures.

- [ ] **Step 2: Run production build**

Run `npm run build`. Expect exit code `0`; existing chunk-size warning is acceptable.

- [ ] **Step 3: Capture close adjustment view**

Open the dashboard with QA device fixtures, select a lamp, enter `调节`, and save the canvas screenshot. Confirm orange and green garments visibly retain their hues and show restrained woven contrast.
