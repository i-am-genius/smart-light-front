# Mobile Single-Row Three Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the mobile ThreeLightingLayout scene toolbar as one compact row instead of two tall rows.

**Architecture:** Keep the existing three toolbar groups and desktop styles. Add compact label spans in the template, then use the existing 620px container breakpoint to place `zone`, `actions`, and `view` in one row and reduce only top-toolbar controls to 32px; bottom context actions retain 44px mobile touch targets.

**Tech Stack:** Vue 3 SFC, scoped CSS container queries, Node test runner, `@vue/compiler-sfc`, Playwright CLI.

## Global Constraints

- Apply compact behavior only when `ThreeLightingLayout` is at most 620px wide.
- Keep every existing toolbar command available.
- Keep desktop and tablet behavior above 620px unchanged.
- The compact toolbar must not wrap or scroll horizontally at a 390px viewport.

---

### Task 1: Compact Mobile Scene Toolbar

**Files:**
- Modify: `tests/threeLightingWorkbenchUi.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue`

**Interfaces:**
- Consumes: existing `layoutState.lamps.length`, `slotCountLabel`, `switchZone`, `addManualSlot`, `handleArrangeSlotsEvenly`, and `setCameraViewMode` bindings.
- Produces: `.toolbar-label-full`, `.toolbar-label-compact`, and a single-row `zone actions view` mobile toolbar layout.

- [ ] **Step 1: Write the failing mobile toolbar contract test**

Replace the existing stacked-toolbar assertion and extend the mobile-state assertion with:

```ts
it('compacts the narrow toolbar into one row', () => {
  assert.match(
    component,
    /@container\s*\(max-width:\s*620px\)\s*\{[\s\S]*?\.scene-toolbar\s*\{[^}]*grid-template-areas:\s*"zone actions view"/,
  )
  assert.doesNotMatch(
    component,
    /grid-template-areas:\s*"zone view"\s*"actions actions"/,
  )
  assert.match(component, /class="toolbar-label-compact"/)
  assert.match(
    component,
    /@container\s*\(max-width:\s*620px\)[\s\S]*?\.toolbar-label-full\s*\{[^}]*display:\s*none/,
  )
  assert.match(
    component,
    /@container\s*\(max-width:\s*620px\)[\s\S]*?\.toolbar-label-compact\s*\{[^}]*display:\s*inline/,
  )
  assert.match(
    component,
    /@media\s*\(max-width:\s*768px\)[\s\S]*?\.zone-arrow-btn,[\s\S]*?min-height:\s*32px/,
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --test tests\threeLightingWorkbenchUi.test.ts
```

Expected: FAIL because the source still contains the two-row `"zone view" "actions actions"` grid and has no compact labels.

- [ ] **Step 3: Add compact template labels**

Update the slot count and toolbar buttons so the default text remains unchanged while narrow containers can show compact text:

```vue
<span class="scene-slot-count">
  <span class="toolbar-label-full">{{ slotCountLabel }}</span>
  <span class="toolbar-label-compact">{{ layoutState.lamps.length }}</span>
</span>
<button
  class="toolbar-action primary-action-btn"
  type="button"
  aria-label="添加灯位"
  title="添加灯位"
  @click.stop="addManualSlot"
>
  <span aria-hidden="true">＋</span>
  <span class="toolbar-label-full">添加灯位</span>
</button>

<button
  class="toolbar-action layout-action-btn"
  type="button"
  aria-label="均匀排列"
  :disabled="layoutState.lamps.length <= 1"
  :title="layoutState.lamps.length <= 1 ? '至少两个灯位' : '均匀排列'"
  @click.stop="handleArrangeSlotsEvenly"
>
  <span class="toolbar-label-full">均匀排列</span>
  <span class="toolbar-label-compact">均排</span>
</button>

<button
  class="view-mode-btn view-toggle-btn"
  :class="{ 'is-active': cameraViewMode === 'display' }"
  type="button"
  aria-label="展示视角"
  title="展示视角"
  :aria-pressed="cameraViewMode === 'display'"
  @click.stop="setCameraViewMode('display')"
>
  <span class="toolbar-label-full">展示</span>
  <span class="toolbar-label-compact">展</span>
</button>
<button
  class="view-mode-btn view-toggle-btn"
  :class="{ 'is-active': cameraViewMode === 'adjust' }"
  type="button"
  aria-label="调节视角"
  title="调节视角"
  :aria-pressed="cameraViewMode === 'adjust'"
  @click.stop="setCameraViewMode('adjust')"
>
  <span class="toolbar-label-full">调节</span>
  <span class="toolbar-label-compact">调</span>
</button>
```

- [ ] **Step 4: Implement the single-row compact CSS**

Add the default visibility rule:

```css
.toolbar-label-compact {
  display: none;
}
```

Change the 620px container toolbar to one row and compact its children:

```css
@container (max-width: 620px) {
  .scene-toolbar {
    top: 8px;
    right: 8px;
    left: 8px;
    grid-template-areas: "zone actions view";
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 4px;
  }

  .scene-edit-actions {
    width: auto;
    gap: 3px;
    padding: 3px;
  }

  .zone-cluster {
    border-radius: 12px;
    padding: 3px;
  }

  .zone-switcher {
    gap: 3px;
  }

  .zone-arrow-btn {
    width: 32px;
    height: 32px;
  }

  .zone-current-label {
    max-width: 68px;
  }

  .scene-slot-count {
    padding: 0 3px;
  }

  .toolbar-action {
    min-height: 32px;
    padding: 0 6px;
  }

  .primary-action-btn {
    width: 32px;
    padding: 0;
  }

  .layout-action-btn {
    min-width: 40px;
  }

  .view-mode-switch {
    gap: 2px;
    border-radius: 12px;
    padding: 3px;
  }

  .view-mode-btn {
    min-width: 32px;
    min-height: 32px;
    padding: 0;
  }

  .toolbar-label-full {
    display: none;
  }

  .toolbar-label-compact {
    display: inline;
  }

  .toolbar-divider {
    display: none;
  }
}
```

Replace the top-control portion of the existing 768px media query with:

```css
@media (max-width: 768px) {
  .zone-arrow-btn,
  .view-mode-btn,
  .toolbar-action {
    min-width: 32px;
    min-height: 32px;
  }

  .context-action {
    min-width: 44px;
    min-height: 44px;
  }
}
```

- [ ] **Step 5: Run focused tests to verify they pass**

Run:

```powershell
node --test tests\threeLightingWorkbenchUi.test.ts tests\deviceZoneComponents.test.ts tests\threeLightingLayoutScene.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Run the production build**

Run:

```powershell
npm run build
```

Expected: `vue-tsc` and Vite build succeed; the existing large-chunk warning may remain.

- [ ] **Step 7: Verify the 390px layout in Playwright**

Open the dashboard with the existing QA device fixtures, resize to `390x844`, and capture `output/playwright/zones-mobile-toolbar-single-row.png`. Verify:

```js
const toolbar = document.querySelector('.scene-toolbar')
const groups = [...toolbar.children].map(element => element.getBoundingClientRect())
({
  toolbarHeight: toolbar.getBoundingClientRect().height,
  oneRow: Math.max(...groups.map(box => box.top)) - Math.min(...groups.map(box => box.top)) < 4,
  noOverflow: toolbar.scrollWidth <= toolbar.clientWidth,
})
```

Expected: `toolbarHeight <= 42`, `oneRow === true`, and `noOverflow === true`.

- [ ] **Step 8: Commit the implementation**

```powershell
git add -- tests/threeLightingWorkbenchUi.test.ts src/components/device/ThreeLightingLayout.vue
git commit -m "fix: compact mobile three toolbar"
```
