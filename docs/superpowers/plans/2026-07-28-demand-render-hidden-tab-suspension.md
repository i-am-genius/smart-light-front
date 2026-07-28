# Demand Rendering and Hidden Tab Suspension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the idle Three.js RAF loop and suspend hidden Tab rendering inputs while preserving every existing transition, visual effect, and real-time update on the visible Tab.

**Architecture:** A framework-independent demand render scheduler owns RAF lifecycle and is integrated into `ThreeLightingLayout.vue` through explicit scene invalidation. A Vue composable creates shallow, per-Tab device snapshots whose source dependency is only active while that Tab is visible; `FlowOverview.vue` similarly gates flow-cache consumption.

**Tech Stack:** Vue 3.5, TypeScript, Three.js r185, Chart.js 4, Node built-in test runner.

## Global Constraints

- Preserve the current 420ms Tab transition, scroll restoration, page height protection, DOM persistence, glass effects, shadows, textures, antialiasing, and renderer pixel ratio.
- Do not change WebSocket message semantics, device merging, API calls, or user actions.
- Do not introduce `KeepAlive`, dynamic Tab components, throttled animation, reduced frame rate, or reduced visual quality.
- Use TDD: every production behavior must be preceded by a focused failing test.
- Do not stage or commit Git changes.

---

### Task 1: Demand Render Scheduler

**Files:**
- Create: `src/components/device/threeDemandRenderLoop.ts`
- Create: `tests/threeDemandRenderLoop.test.ts`

**Interfaces:**
- Consumes: injected `shouldRun`, `update`, `render`, `requestFrame`, and `cancelFrame` functions.
- Produces: `createDemandRenderLoop(options)` returning `invalidate()`, `stop()`, and `isRunning()`.

- [ ] **Step 1: Write the failing scheduler tests**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemandRenderLoop } from '../src/components/device/threeDemandRenderLoop.ts'

test('renders one invalidated frame and becomes idle without control motion', () => {
  const harness = createFrameHarness()
  let renders = 0
  const loop = createDemandRenderLoop({
    shouldRun: () => true,
    update: () => false,
    render: () => { renders += 1 },
    requestFrame: harness.request,
    cancelFrame: harness.cancel,
  })

  loop.invalidate()
  loop.invalidate()
  assert.equal(harness.pending(), 1)
  harness.flushOne()
  assert.equal(renders, 1)
  assert.equal(loop.isRunning(), false)
})

test('continues through damping and stops after controls settle', () => {
  const harness = createFrameHarness()
  const changes = [true, true, false]
  let renders = 0
  const loop = createDemandRenderLoop({
    shouldRun: () => true,
    update: () => changes.shift() ?? false,
    render: () => { renders += 1 },
    requestFrame: harness.request,
    cancelFrame: harness.cancel,
  })

  loop.invalidate()
  harness.flushAll()
  assert.equal(renders, 2)
  assert.equal(loop.isRunning(), false)
})
```

Add cases for invalidation during a frame, `shouldRun() === false`, and `stop()` cancellation.

- [ ] **Step 2: Run the scheduler test and verify RED**

Run: `node --test tests/threeDemandRenderLoop.test.ts`

Expected: FAIL because `threeDemandRenderLoop.ts` does not exist.

- [ ] **Step 3: Implement the minimal scheduler**

```ts
export function createDemandRenderLoop(options: DemandRenderLoopOptions) {
  let frameId: number | null = null
  let invalidated = false

  const tick = () => {
    frameId = null
    if (!options.shouldRun()) {
      invalidated = false
      return
    }

    const renderThisFrame = invalidated
    invalidated = false
    const controlsChanged = options.update()
    if (renderThisFrame || controlsChanged) options.render()
    if (invalidated || controlsChanged) schedule()
  }

  const schedule = () => {
    if (frameId !== null || !options.shouldRun()) return
    frameId = options.requestFrame(tick)
  }

  return {
    invalidate() {
      invalidated = true
      schedule()
    },
    stop() {
      invalidated = false
      if (frameId !== null) options.cancelFrame(frameId)
      frameId = null
    },
    isRunning() {
      return frameId !== null
    },
  }
}
```

- [ ] **Step 4: Run the scheduler tests and verify GREEN**

Run: `node --test tests/threeDemandRenderLoop.test.ts`

Expected: all demand render scheduler tests PASS.

### Task 2: Integrate Demand Rendering into ThreeLightingLayout

**Files:**
- Modify: `src/components/device/ThreeLightingLayout.vue`
- Modify: `tests/tabSwitchPerformance.test.ts`
- Modify: `tests/threeLightingLayoutScene.test.ts`

**Interfaces:**
- Consumes: `createDemandRenderLoop` from Task 1.
- Produces: `requestSceneRender()` as the single scene invalidation entry point inside the component.

- [ ] **Step 1: Add failing source-structure tests**

Assert that:

```ts
assert.match(source, /createDemandRenderLoop/)
assert.match(source, /function requestSceneRender\(\)/)
assert.match(source, /controls\.addEventListener\('change', requestSceneRender\)/)
assert.doesNotMatch(source, /animationFrame = requestAnimationFrame\(renderLoop\)/)
assert.match(source, /requestSceneRender\(\)[\s\S]*renderer\.setSize/)
```

Also assert that the existing `props.active` and `document.hidden` guards remain.

- [ ] **Step 2: Run focused Three tests and verify RED**

Run: `node --test tests/tabSwitchPerformance.test.ts tests/threeLightingLayoutScene.test.ts`

Expected: FAIL because demand rendering is not integrated.

- [ ] **Step 3: Replace the continuous loop**

Create the scheduler after renderer, scene, camera, and controls exist:

```ts
demandRenderLoop = createDemandRenderLoop({
  shouldRun: () => Boolean(props.active && !document.hidden && renderer && scene && camera),
  update: () => controls?.update() ?? false,
  render: () => {
    if (renderer && scene && camera) renderer.render(scene, camera)
  },
})
controls.addEventListener('change', requestSceneRender)
```

Replace `startRenderLoop()` with `requestSceneRender()`, keep `stopRenderLoop()` as a scheduler stop wrapper, and remove the self-scheduling `renderLoop()`.

Call `requestSceneRender()` after initialization, resize, layout visual updates, device/zone rebuilds, texture application, pointer-driven changes, camera animation steps, Tab reactivation, and visibility restoration.

Remove the OrbitControls `change` listener during cleanup.

- [ ] **Step 4: Run focused Three tests and verify GREEN**

Run: `node --test tests/threeDemandRenderLoop.test.ts tests/tabSwitchPerformance.test.ts tests/threeLightingLayoutScene.test.ts`

Expected: all focused Three and Tab tests PASS.

### Task 3: Active Array Snapshot

**Files:**
- Create: `src/composables/useActiveArraySnapshot.ts`
- Create: `tests/activeArraySnapshot.test.ts`

**Interfaces:**
- Consumes: `source: () => readonly T[]` and `active: () => boolean`.
- Produces: `ShallowRef<T[]>` preserving the last active shallow snapshot.

- [ ] **Step 1: Write failing composable tests**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick, ref } from 'vue'
import { useActiveArraySnapshot } from '../src/composables/useActiveArraySnapshot.ts'

test('does not follow source updates while inactive and catches up on activation', async () => {
  const active = ref(false)
  const source = ref([{ id: 1, online: false }])
  const scope = effectScope()
  const snapshot = scope.run(() =>
    useActiveArraySnapshot(() => source.value, () => active.value),
  )!

  source.value = [{ id: 1, online: true }]
  await nextTick()
  assert.deepEqual(snapshot.value, [])

  active.value = true
  await nextTick()
  assert.deepEqual(snapshot.value, [{ id: 1, online: true }])
  assert.notEqual(snapshot.value[0], source.value[0])

  active.value = false
  await nextTick()
  source.value = [{ id: 1, online: false }]
  await nextTick()
  assert.equal(snapshot.value[0].online, true)
  scope.stop()
})
```

Add a case confirming updates continue while active and only the latest source state is applied after reactivation.

- [ ] **Step 2: Run the composable test and verify RED**

Run: `node --test tests/activeArraySnapshot.test.ts`

Expected: FAIL because `useActiveArraySnapshot.ts` does not exist.

- [ ] **Step 3: Implement the conditional watchEffect**

```ts
import { shallowRef, watchEffect, type ShallowRef } from 'vue'

export function useActiveArraySnapshot<T extends object>(
  source: () => readonly T[],
  active: () => boolean,
): ShallowRef<T[]> {
  const snapshot = shallowRef<T[]>([])
  watchEffect(() => {
    if (!active()) return
    snapshot.value = source().map(item => ({ ...item }))
  })
  return snapshot
}
```

- [ ] **Step 4: Run the composable tests and verify GREEN**

Run: `node --test tests/activeArraySnapshot.test.ts`

Expected: all active snapshot tests PASS.

### Task 4: Gate Dashboard and Flow Rendering Inputs

**Files:**
- Modify: `src/views/SmartLightDashboard.vue`
- Modify: `src/components/flow/FlowOverview.vue`
- Modify: `tests/tabSwitchPerformance.test.ts`

**Interfaces:**
- Consumes: `useActiveArraySnapshot` from Task 3.
- Produces: `mainDevices`, `flowDevices`, and `settingsDevices` render-only snapshots; `FlowOverview.active`.

- [ ] **Step 1: Add failing integration constraints**

Assert that Dashboard creates:

```ts
useActiveArraySnapshot(() => devices.value, () => activeTab.value === 'main')
useActiveArraySnapshot(() => devices.value, () => activeTab.value === 'flow')
useActiveArraySnapshot(() => devices.value, () => activeTab.value === 'settings')
```

Assert that live `devices` bindings for DeviceGrid, ThreeLightingLayout, FlowOverview, FlowMonitorPanel, and ArmControlPanel are replaced by the matching snapshot, and that FlowOverview receives `:active="activeTab === 'flow'"`.

Assert that FlowOverview uses a conditional `watchEffect` whose inactive branch returns before reading `props.flowCache`.

- [ ] **Step 2: Run the Tab performance test and verify RED**

Run: `node --test tests/tabSwitchPerformance.test.ts`

Expected: FAIL because active render snapshots and FlowOverview gating are absent.

- [ ] **Step 3: Wire active snapshots and flow-cache gating**

In Dashboard:

```ts
const mainDevices = useActiveArraySnapshot(
  () => devices.value,
  () => activeTab.value === 'main',
)
const flowDevices = useActiveArraySnapshot(
  () => devices.value,
  () => activeTab.value === 'flow',
)
const settingsDevices = useActiveArraySnapshot(
  () => devices.value,
  () => activeTab.value === 'settings',
)
```

Use these values only as component rendering props. Keep every business method on the live `devices` ref.

In FlowOverview:

```ts
const props = defineProps<{
  active: boolean
  // existing props remain unchanged
}>()

watchEffect(() => {
  if (!props.active) return
  const cache = props.flowCache
  if (!cache) return
  applyCache(cache)
})
```

Change `applyCache` to consume the captured cache argument so its hidden branch does not accidentally subscribe to `props.flowCache`.

- [ ] **Step 4: Run all focused tests and verify GREEN**

Run:

```text
node --test tests/activeArraySnapshot.test.ts tests/threeDemandRenderLoop.test.ts tests/tabSwitchPerformance.test.ts tests/threeLightingLayoutScene.test.ts
```

Expected: all focused tests PASS.

### Task 5: Full Verification

**Files:**
- Verify only; no new production files.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: evidence that behavior and build remain stable.

- [ ] **Step 1: Run the full Node test suite**

Run: `node --test tests/*.test.ts`

Expected: all task-related tests PASS. Record any unrelated pre-existing failure without modifying unrelated code.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite build succeed; the existing chunk-size warning is acceptable.

- [ ] **Step 3: Check diff hygiene**

Run:

```text
git diff --check -- src/components/device/threeDemandRenderLoop.ts src/components/device/ThreeLightingLayout.vue src/composables/useActiveArraySnapshot.ts src/views/SmartLightDashboard.vue src/components/flow/FlowOverview.vue tests/threeDemandRenderLoop.test.ts tests/activeArraySnapshot.test.ts tests/tabSwitchPerformance.test.ts tests/threeLightingLayoutScene.test.ts
```

Expected: exit code 0, allowing only repository line-ending notices.

- [ ] **Step 4: Review visual invariants statically**

Confirm the diff does not alter Tab transition duration, page-switch height/overflow behavior, Three.js pixel ratio, antialiasing, shadow budgets, materials, textures, or Chart.js styling.
