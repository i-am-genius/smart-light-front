# Auth Light Vue Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved pointer-following lamp and readable warm light effect to login, registration, and store initialization without changing their current layout, background, or form behavior.

**Architecture:** Mount one shared `AuthFollowLight` component inside `AuthShell`, because all three target views already consume that shell. Keep the non-linear follower in a pure TypeScript module for deterministic tests, while the Vue component owns pointer/media-query listeners, CSS custom properties, Three.js resources, and cleanup.

**Tech Stack:** Vue 3 Composition API, TypeScript, Three.js 0.185, CSS custom properties and radial masks, Node built-in test runner, Vite.

## Global Constraints

- Treat the current working copy of `docs/prototypes/auth-light-follow.html` as the behavior and lamp-model reference.
- Preserve the existing `AuthShell` layout, day background, card styling, and all login/register/store-setup business logic.
- Desktop uses automatic pointer following with delayed non-linear acceleration; no dragging, swing physics, or user-facing light controls.
- Mobile at `max-width: 760px` and reduced-motion mode are static and default to the form-card region.
- Lighting layers never receive pointer events and never make unlit text unreadable.
- Remove every listener, animation frame, WebGL resource, and renderer on unmount.

---

### Task 1: Extract The Tested Motion Kernel

**Files:**
- Create: `src/components/auth/authFollowLightMotion.ts`
- Create: `tests/authFollowLightMotion.test.ts`

**Interfaces:**
- Produces: `FollowState`, `advanceFollower(state, target, dt)`, `clampTrackTarget(pointerX, viewportWidth)`, and `isStaticLightMode(viewportWidth, reducedMotion)`.
- Consumes: Numeric constants copied from the approved prototype: acceleration cap `9200`, coefficient `240`, exponent `.78`, damping `6`, maximum speed `1500`, and desktop track `22%` through `78%`.

- [ ] **Step 1: Write the failing motion tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceFollower,
  clampTrackTarget,
  isStaticLightMode,
} from '../src/components/auth/authFollowLightMotion.ts'

test('far targets accelerate faster without overshoot', () => {
  const near = advanceFollower({ position: 0, velocity: 0 }, 20, 1 / 60)
  const far = advanceFollower({ position: 0, velocity: 0 }, 200, 1 / 60)
  assert.ok(far.position > near.position)
  assert.ok(far.position <= 200)
})

test('track remains inside the approved desktop range', () => {
  assert.equal(clampTrackTarget(0, 1000), 220)
  assert.equal(clampTrackTarget(1000, 1000), 780)
})

test('mobile and reduced motion use static lighting', () => {
  assert.equal(isStaticLightMode(760, false), true)
  assert.equal(isStaticLightMode(1440, true), true)
  assert.equal(isStaticLightMode(1440, false), false)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/authFollowLightMotion.test.ts`

Expected: FAIL because `authFollowLightMotion.ts` does not exist.

- [ ] **Step 3: Implement the pure motion functions**

Implement the exact prototype kernel, monotonic target clamping, the `22%` to `78%` desktop track, and the `760px` static breakpoint.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/authFollowLightMotion.test.ts`

Expected: all motion tests pass.

### Task 2: Build And Mount The Shared Light Component

**Files:**
- Create: `src/components/auth/AuthFollowLight.vue`
- Modify: `src/components/auth/AuthShell.vue`
- Create: `tests/authFollowLightIntegration.test.ts`

**Interfaces:**
- Consumes: motion exports from Task 1 and the nearest `.auth-card` element inside the same `.auth-page`.
- Produces: a decorative `AuthFollowLight` component with `aria-hidden="true"`, a transparent Three.js canvas, fixed CSS light layers, a CSS fallback lamp, desktop pointer following, and static mobile/reduced-motion behavior.

- [ ] **Step 1: Write the failing integration contract test**

The test must assert that `AuthShell.vue` imports and renders `AuthFollowLight`, all three target views render `AuthShell`, the light component imports the pure kernel and Three.js, uses passive `pointermove`, listens for both media-query changes, and removes listeners/cancels animation on unmount.

- [ ] **Step 2: Run the integration test and verify RED**

Run: `node --test tests/authFollowLightIntegration.test.ts`

Expected: FAIL because `AuthFollowLight.vue` does not exist and `AuthShell.vue` does not mount it.

- [ ] **Step 3: Implement the component and shell mount**

Add `<AuthFollowLight />` as a decorative sibling before `.auth-shell`. Give `.auth-shell` a local stacking position without changing its dimensions. In the component, create the dark-metal shade, copper connector, emissive underside, bulb, glow sprite, and point light from the approved prototype; omit the removed rail and visible power cable.

- [ ] **Step 4: Implement lighting and accessibility behavior**

Use fixed full-viewport warm spotlight/bloom layers with mild peripheral dimming, `pointer-events: none`, and form-centered defaults measured from `.auth-card`. Disable tracking and continuous animation at `760px` and for reduced motion. Keep a readable CSS fallback if WebGL initialization fails.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts`

Expected: all focused tests pass.

### Task 3: Verify The Three Target Routes

**Files:**
- Verify: `src/views/LoginView.vue`
- Verify: `src/views/RegisterView.vue`
- Verify: `src/views/StoreSetup.vue`
- Verify: `src/components/auth/AuthFollowLight.vue`

**Interfaces:**
- Consumes: the shared `AuthShell` integration from Task 2.
- Produces: evidence that all three routes render the same effect and keep forms operable.

- [ ] **Step 1: Run the complete prototype and integration tests**

Run: `node --test tests/authLightFollowPrototype.test.mjs tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Vue type-check and Vite production build pass; the existing large-chunk warning may remain.

- [ ] **Step 3: Visually verify desktop routes**

Open `/login`, `/register`, and `/store-setup` at `1440x900`. Move the pointer across left, center, and right positions. Confirm the lamp and warm spot follow without blocking form interaction, while layout and background match the pre-integration screenshots.

- [ ] **Step 4: Visually verify mobile and reduced motion**

Open all three routes at `390x844`, then emulate reduced motion at desktop width. Confirm the lamp and spotlight remain static over the form and no on-screen element overlaps form controls or text.

- [ ] **Step 5: Commit only integration-owned files**

```bash
git add src/components/auth/AuthFollowLight.vue src/components/auth/authFollowLightMotion.ts src/components/auth/AuthShell.vue tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts docs/superpowers/plans/2026-07-22-auth-light-vue-integration.md
git commit -m "feat: add shared auth follow light"
```
