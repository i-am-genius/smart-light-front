# Mobile Phone Density Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct horizontal overflow and excessive vertical density in the dashboard at mainstream phone widths of 360, 393, 412, and 430 CSS pixels.

**Architecture:** Keep desktop and tablet layouts unchanged. Add component-scoped phone rules that change only the affected grids, width containment, and spacing while preserving readable text and touch targets.

**Tech Stack:** Vue 3 scoped CSS, TypeScript, Node test runner, Vite, Capacitor Android.

## Global Constraints

- Preserve all unrelated changes in the dirty worktree.
- Do not use page-level zoom or transform scaling.
- Keep functional controls at least 40px tall and primary touch targets at least 44px where practical.
- Verify the widths 360px, 393px, 412px, and 430px.
- Do not change component behavior, emitted events, API calls, or device state.

---

### Task 1: Encode the mobile density contract

**Files:**
- Modify: `tests/mobileResponsiveDensity.test.ts`

**Interfaces:**
- Consumes: component source CSS from the seven affected Vue files.
- Produces: regression assertions for phone grids, containment, and compact spacing.

- [ ] **Step 1: Write failing assertions**

Add source fixtures for the dashboard, store settings, SmartConfig, and flow monitor. Assert that light effects use two columns, gimbal presets remain two columns at 480px, the 3D scene has defensive width containment and forced compact toolbar labels, and the requested panels have explicit compact mobile spacing.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test --experimental-strip-types tests/mobileResponsiveDensity.test.ts`

Expected: FAIL because the current light-effect grid is three columns, the 480px gimbal rule is one column, the flow placeholder is 180px, and the new containment/spacing declarations are absent.

- [ ] **Step 3: Preserve the failing result before production edits**

Do not relax regex assertions to match desktop declarations. Each assertion must be scoped to the relevant mobile media query.

---

### Task 2: Fix phone grids and 3D scene overflow

**Files:**
- Modify: `src/components/device/LightEffectMiniPanel.vue`
- Modify: `src/components/settings/ArmControlPanel.vue`
- Modify: `src/components/device/ThreeLightingLayout.vue`
- Test: `tests/mobileResponsiveDensity.test.ts`

**Interfaces:**
- Consumes: existing `.effect-action-grid`, `.gimbal-preset-side`, and 3D toolbar classes.
- Produces: `2 x 3` light effects, `2 x 2` gimbal presets, and a contained 3D workbench at phone widths.

- [ ] **Step 1: Change the effect grid**

Set the mobile `.effect-action-grid` to `grid-template-columns: repeat(2, minmax(0, 1fr))` and retain compact gaps.

- [ ] **Step 2: Keep gimbal presets two-column on small phones**

Replace the `max-width: 480px` one-column override with `repeat(2, minmax(0, 1fr))`. Compact preset padding and text without dropping below usable touch height.

- [ ] **Step 3: Contain the 3D scene and force phone labels compact**

Give the shell, wrapper, viewport, toolbar clusters, and canvas `min-width: 0` / `max-width: 100%` where needed. At `max-width: 480px`, override the container query so full labels remain hidden and compact labels remain visible.

- [ ] **Step 4: Run the focused test**

Run: `node --test --experimental-strip-types tests/mobileResponsiveDensity.test.ts`

Expected: the grid and containment assertions PASS.

---

### Task 3: Reduce dashboard and settings vertical density

**Files:**
- Modify: `src/views/SmartLightDashboard.vue`
- Modify: `src/components/settings/StoreSettingsPanel.vue`
- Modify: `src/components/settings/SmartConfigPanel.vue`
- Modify: `src/components/settings/FlowMonitorPanel.vue`
- Modify: `src/components/settings/ArmControlPanel.vue`
- Test: `tests/mobileResponsiveDensity.test.ts`

**Interfaces:**
- Consumes: existing mobile media queries and component card structures.
- Produces: shorter realtime overview, store overview, gimbal, SmartConfig, and people-flow cards.

- [ ] **Step 1: Compact realtime overview**

Reduce mobile `env-card` section padding, title margin, and stat/meta item padding while preserving the current five-stat and three-meta single rows.

- [ ] **Step 2: Close the settings section gap**

Reduce the phone store-card padding and dashboard settings-group margin/title spacing. Keep the three store action buttons in one row.

- [ ] **Step 3: Compact gimbal and SmartConfig internals**

Reduce descriptive spacing, self-test spacing, joystick section gaps, SmartConfig heading/steps/form/action/message/tip gaps, and keep form/button controls usable.

- [ ] **Step 4: Reduce people-flow upload dominance**

Reduce the phone image placeholder to 120px, cap previews at 160px, and tighten the upload card/header/body spacing.

- [ ] **Step 5: Run the focused test**

Run: `node --test --experimental-strip-types tests/mobileResponsiveDensity.test.ts`

Expected: PASS.

---

### Task 4: Verify production output and real phone proportions

**Files:**
- Verify only: all files modified by Tasks 1-3.

**Interfaces:**
- Consumes: the completed CSS and regression tests.
- Produces: buildable web and synchronized Android assets with no horizontal overflow at target widths.

- [ ] **Step 1: Run the complete test suite**

Run the repository's Node tests with the same command pattern used by the existing suite.

Expected: all tests PASS.

- [ ] **Step 2: Build and synchronize Android**

Run: `npm run android:sync`

Expected: Vue type-check, Vite production build, and Capacitor Android sync all succeed.

- [ ] **Step 3: Browser QA at all target widths**

Inspect 360x800, 393x852, 412x915, and 430x932. Confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth`, all six light effects render as two columns, all four gimbal presets render as two columns, and card contents do not overlap.

- [ ] **Step 4: Review the final diff**

Confirm that only the plan, regression test, and requested component style blocks changed during this fix.
