# Tab Switch Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate repeated tab lifecycle work while preserving every existing visual effect and transition.

**Architecture:** Lazily mount each dashboard tab once, retain it with `v-show`, and keep the existing Vue transition hooks on independent transitions. Cache sidebar refraction source pixels when the source scene changes so animation frames reuse identical input data.

**Tech Stack:** Vue 3, TypeScript, Three.js, Chart.js, Node test runner, Vite

## Global Constraints

- Preserve the existing 420 ms directional page transition.
- Preserve Three.js renderer quality, textures, materials, shadows, and DPR.
- Preserve sidebar refraction pixels and interaction behavior.
- Do not overwrite unrelated working-tree changes.

---

### Task 1: Persist visited dashboard tabs

**Files:**
- Modify: `src/views/SmartLightDashboard.vue`
- Test: `tests/tabSwitchPerformance.test.ts`

**Interfaces:**
- Consumes: `DashboardTab`, `activeTab`, existing transition hooks.
- Produces: `mountedTabs: Set<DashboardTab>` and four lazily mounted, independently transitioned sections.

- [ ] **Step 1: Write the failing persistence contract test**

```ts
it('lazily mounts each dashboard tab once and hides it without unmounting', () => {
  assert.match(source, /const mountedTabs = ref\(new Set<DashboardTab>/)
  assert.match(source, /mountedTabs\.value\.add\(tab\)/)
  for (const tab of ['main', 'flow', 'settings', 'firmware']) {
    assert.match(source, new RegExp(`v-if="mountedTabs\\.has\\('${tab}'\\)"[\\s\\S]*?v-show="activeTab === '${tab}'"`))
  }
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/tabSwitchPerformance.test.ts`

Expected: FAIL because `mountedTabs` and persistent `v-show` sections do not exist.

- [ ] **Step 3: Implement lazy persistent sections**

```ts
const mountedTabs = ref(new Set<DashboardTab>([activeTab.value]))

watch(activeTab, (tab, oldTab) => {
  if (!mountedTabs.value.has(tab)) {
    mountedTabs.value = new Set(mountedTabs.value).add(tab)
  }
  // retain existing direction, scroll, and preload behavior
})
```

Wrap each section in its own `Transition`, use `v-if="mountedTabs.has(...)"`, and use `v-show` for active visibility.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/tabSwitchPerformance.test.ts`

Expected: PASS.

### Task 2: Cache sidebar refraction source pixels

**Files:**
- Modify: `src/components/layout/SidebarNav.vue`
- Test: `tests/tabSwitchPerformance.test.ts`

**Interfaces:**
- Consumes: `bgCtx`, `dragBgCtx`, `SW`, `SH`, `refreshRefractionSources()`.
- Produces: `bgImageCache`, `dragBgImageCache`, and `getRefractionSourceImage(mode)`.

- [ ] **Step 1: Add the failing cache contract test**

```ts
it('reads refraction source pixels only when rebuilding the source scene', () => {
  assert.match(sidebarSource, /let bgImageCache: ImageData \| null = null/)
  assert.match(sidebarSource, /function getRefractionSourceImage\(mode: RefractionMode\)/)
  const renderer = extractFunction(sidebarSource, 'renderRefractionAtRect')
  assert.doesNotMatch(renderer, /getImageData\(/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/tabSwitchPerformance.test.ts`

Expected: FAIL because every frame still calls `getImageData()`.

- [ ] **Step 3: Implement the minimal pixel cache**

Create both caches, populate them at the end of `refreshRefractionSources()`, and select the cached source in `renderRefractionAtRect()`. Request read-optimized 2D contexts using `{ willReadFrequently: true }`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/tabSwitchPerformance.test.ts`

Expected: PASS.

### Task 3: Verify behavior and performance

**Files:**
- Verify: `src/views/SmartLightDashboard.vue`
- Verify: `src/components/layout/SidebarNav.vue`
- Modify: `src/components/device/ThreeLightingLayout.vue`
- Test: `tests/tabSwitchPerformance.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: build evidence and desktop/mobile runtime evidence.

- [ ] **Step 1: Run the complete test suite**

Run: `node --test tests/*.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Protect retained Three.js sizing**

When `main` becomes active, wait for `nextTick()`, re-check activity/visibility, resize the retained renderer, then restart its loop. Ignore non-positive host dimensions in `handleResize()` so a resize while the tab is hidden cannot set an invalid camera aspect or zero-sized renderer.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Browser QA at desktop and mobile sizes**

At 1440 × 900 and 390 × 844, switch `main ↔ flow`, `main ↔ settings`, and `main ↔ firmware`. Verify the 420 ms directional motion, correct content, restored scroll positions, stable canvas identity/counts, resize/orientation recovery, and no repeated Three.js renderer initialization after the first mount.

- [ ] **Step 5: Review the final diff**

Run: `git diff -- src/views/SmartLightDashboard.vue src/components/layout/SidebarNav.vue tests/tabSwitchPerformance.test.ts docs/superpowers/specs/2026-07-21-tab-switch-performance-design.md docs/superpowers/plans/2026-07-21-tab-switch-performance.md`

Expected: only the approved performance scope is present.
