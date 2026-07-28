# Remove Boutique Scene Caption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the decorative boutique scene caption and its unused CSS without changing other Three workbench controls.

**Architecture:** Delete the isolated `.scene-overlay` template and style blocks. Convert the existing positive overlay tests into negative assertions while retaining luminaire and responsive contracts.

**Tech Stack:** Vue 3 SFC, CSS, Node test runner.

## Global Constraints

- Remove both “精品服装灯光” and “轨道编排工作台”.
- Remove all `.scene-overlay` DOM and CSS.
- Preserve all other scene controls and Three rendering behavior.
- Do not commit.

---

### Task 1: Remove the decorative scene overlay

**Files:**
- Modify: `tests/threeLightingLayoutScene.test.ts`
- Modify: `tests/threeLightingWorkbenchUi.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue`

**Interfaces:**
- Consumes: the existing Three workbench template and scoped CSS.
- Produces: the same workbench without the decorative caption.

- [ ] **Step 1: Write failing negative assertions**

Assert that the component source contains neither `.scene-overlay` nor either caption string, while retaining existing luminaire, toolbar, responsive, and reduced-motion assertions.

- [ ] **Step 2: Verify RED**

Run `node --test tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts`. Expect failure because the overlay still exists.

- [ ] **Step 3: Delete the overlay template and CSS**

Remove the template block at the top of `ThreeLightingLayout.vue`, the desktop `.scene-overlay`, `.scene-overlay span`, and `.scene-overlay small` rules, and the mobile `.scene-overlay { display: none; }` rule.

- [ ] **Step 4: Verify GREEN and build**

Run the two focused suites, the full seven-suite Three command, and `npm run build`. Expect zero test failures and build exit code `0`.
