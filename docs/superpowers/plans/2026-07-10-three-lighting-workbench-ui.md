# Three 场景沉浸式灯光编排工作台 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Three.js 精品服装店场景改造成以 3D 视口为主体、具有悬浮场景工具栏和选中上下文操作台的灯光编排工作台。

**Architecture:** 所有产品代码改动都限制在现有 `ThreeLightingLayout.vue`：模板重排负责视觉层级，两个只读 computed 和一个视角包装函数复用现有状态与处理入口，scoped CSS 负责桌面、平板、移动端、夜间模式和无障碍状态。新增一个独立源码契约测试保护 UI 结构；现有 Three 场景契约测试继续保护设备交互与渲染锚点。

**Tech Stack:** Vue 3 `<script setup>`, TypeScript 6, Three.js r185, scoped CSS, Node.js built-in test runner, Vite 8

## Global Constraints

- 不修改 `SmartLightDashboard.vue`；所有悬浮工具层必须留在 `ThreeLightingLayout.vue` 当前容器边界内。
- 不修改设备数据、灯位绑定、分区切换、拖拽、排序、删除、均匀排列、相机预设、本地持久化、props 或 emits。
- 不新增依赖、网络请求、字体、图标包、后端字段或持久化字段。
- 主操作蓝固定为 `#2563EB`，精品店点缀金固定为 `#C8A56C`，危险色固定为 `#DC2626`。
- 桌面视口保持 430px；不大于 768px 时保持 360px；移动端所有交互控件的触控区域不小于 44 × 44px。
- 保留清晰的 `:focus-visible`、`disabled`、解释性 `title`、`aria-label`、`aria-pressed` 和 `prefers-reduced-motion` 行为。
- 当前工作区已有未提交改动。不得使用 `git add src/components/device/ThreeLightingLayout.vue` 整文件暂存；每次提交必须用 `git add -p`，只接受本计划新增的 workbench hunks，遇到混合 hunk 使用 `s` 或 `e` 拆分。

## File Map

- `src/components/device/ThreeLightingLayout.vue` — 唯一产品代码改动点；重排模板、增加只读展示状态、增加视角模式包装函数、替换工作台样式。
- `tests/threeLightingWorkbenchUi.test.ts` — 新建；只读扫描 Vue 源码，保护工作台层级、事件入口、响应式、主题和无障碍锚点。
- `tests/threeLightingLayoutScene.test.ts` — 不修改；作为现有 Three 场景、设备交互和精品店视觉的回归测试运行。
- `docs/superpowers/specs/2026-07-10-three-lighting-workbench-ui-design.md` — 只读设计依据。

---

### Task 1: 建立工作台结构、展示状态和桌面视觉

**Files:**
- Create: `tests/threeLightingWorkbenchUi.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue:1-58, 207-225, 2034-2040, 2129-2410`
- Test: `tests/threeLightingWorkbenchUi.test.ts`
- Regression: `tests/threeLightingLayoutScene.test.ts`

**Interfaces:**
- Consumes: `activeZone`, `activeZoneIndex`, `zoneCount`, `layoutState.lamps`, `selectedSlot`, `selectedSlotLabel`, `canMoveSelectedLeft`, `canMoveSelectedRight`, `canDeleteSelectedSlot`, `deleteSlotTitle`, `cameraViewMode`, `toggleCameraView()`.
- Produces: `slotCountLabel: ComputedRef<string>`, `selectedSlotStatusLabel: ComputedRef<string>`, `setCameraViewMode(mode: CameraViewMode): void`, and the template anchors `.scene-toolbar`, `.scene-context-bar`, `.scene-empty-hint`, `.view-mode-switch`.

- [ ] **Step 1: 写入失败的 UI 契约测试**

Create `tests/threeLightingWorkbenchUi.test.ts` with this complete content:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const component = readFileSync(
  new URL('../src/components/device/ThreeLightingLayout.vue', import.meta.url),
  'utf8',
)

describe('ThreeLightingLayout workbench UI contract', () => {
  it('keeps every existing layout command wired to the workbench', () => {
    assert.match(component, /@click\.stop="switchZone\(-1\)"/)
    assert.match(component, /@click\.stop="switchZone\(1\)"/)
    assert.match(component, /@click\.stop="addManualSlot"/)
    assert.match(component, /@click\.stop="moveSelectedSlot\(-1\)"/)
    assert.match(component, /@click\.stop="moveSelectedSlot\(1\)"/)
    assert.match(component, /@click\.stop="deleteSelectedSlot"/)
    assert.match(component, /@click\.stop="handleArrangeSlotsEvenly"/)
  })

  it('renders an in-scene toolbar with explicit camera modes', () => {
    assert.match(component, /class="scene-toolbar"/)
    assert.match(component, /class="zone-cluster workbench-glass"/)
    assert.match(component, /class="scene-edit-actions slot-toolbar workbench-glass"/)
    assert.match(component, /class="[^"\n]*primary-action-btn[^"\n]*"/)
    assert.match(component, /class="[^"\n]*layout-action-btn[^"\n]*"/)
    assert.match(component, /class="view-mode-switch workbench-glass" role="group" aria-label="场景视角"/)
    assert.match(component, /:aria-pressed="cameraViewMode === 'display'"/)
    assert.match(component, /:aria-pressed="cameraViewMode === 'adjust'"/)
    assert.match(component, /@click\.stop="setCameraViewMode\('display'\)"/)
    assert.match(component, /@click\.stop="setCameraViewMode\('adjust'\)"/)
    assert.match(component, /const slotCountLabel = computed\(\(\) => `\$\{layoutState\.lamps\.length\} 个灯位`\)/)
    assert.match(component, /function setCameraViewMode\(mode: CameraViewMode\)/)
  })

  it('shows selection commands only inside the context bar', () => {
    assert.match(component, /class="scene-context-layer"/)
    assert.match(component, /v-if="selectedSlot" class="scene-context-bar workbench-glass"/)
    assert.match(component, /v-else class="scene-empty-hint workbench-glass"/)
    assert.match(component, /点击射灯后可编辑位置/)
    assert.match(component, /拖动射灯调整陈列焦点/)
    assert.match(component, /const selectedSlotStatusLabel = computed/)
    assert.match(component, /class="[^"\n]*context-action[^"\n]*danger[^"\n]*"/)
    assert.doesNotMatch(component, /class="three-controls-panel"/)
  })

  it('uses the approved interaction colours and preserves canvas input', () => {
    assert.match(component, /--workbench-blue:\s*#2563eb/i)
    assert.match(component, /--workbench-gold:\s*#c8a56c/i)
    assert.match(component, /--workbench-danger:\s*#dc2626/i)
    assert.match(component, /\.primary-action-btn\s*\{[^}]*background:\s*var\(--workbench-blue\)/)
    assert.match(component, /\.view-mode-btn\.is-active\s*\{[^}]*background:\s*var\(--workbench-blue\)/)
    assert.match(component, /\.context-action\.danger\s*\{[^}]*color:\s*var\(--workbench-danger\)/)
    assert.match(component, /\.scene-context-layer\s*\{[^}]*pointer-events:\s*none/)
    assert.match(component, /\.scene-context-bar\s*\{[^}]*pointer-events:\s*auto/)
    assert.match(component, /\.scene-overlay\s*\{[^}]*pointer-events:\s*none/)
  })
})
```

- [ ] **Step 2: 运行测试并确认它因工作台结构缺失而失败**

Run:

```bash
node --test tests/threeLightingWorkbenchUi.test.ts
```

Expected: FAIL in `renders an in-scene toolbar with explicit camera modes`; the first missing match contains `class="scene-toolbar"`.

- [ ] **Step 3: 用工作台模板替换现有 template**

Replace the complete `<template>...</template>` block in `src/components/device/ThreeLightingLayout.vue` with:

```vue
<template>
  <div class="three-layout-shell">
    <div class="three-viewport-wrap">
      <div class="scene-toolbar" @pointerdown.stop>
        <div class="zone-cluster workbench-glass">
          <div class="zone-switcher">
            <button
              class="zone-arrow-btn"
              type="button"
              aria-label="上一个区域"
              :disabled="zoneCount <= 1"
              @click.stop="switchZone(-1)"
            >
              ‹
            </button>
            <div class="zone-current-label">
              <strong :title="activeZone.zoneName">{{ activeZone.zoneName }}</strong>
              <span>{{ activeZoneIndex + 1 }} / {{ zoneCount }}</span>
            </div>
            <button
              class="zone-arrow-btn"
              type="button"
              aria-label="下一个区域"
              :disabled="zoneCount <= 1"
              @click.stop="switchZone(1)"
            >
              ›
            </button>
          </div>
        </div>

        <div class="scene-edit-actions slot-toolbar workbench-glass">
          <span class="scene-slot-count">{{ slotCountLabel }}</span>
          <span class="toolbar-divider" aria-hidden="true"></span>
          <button class="toolbar-action primary-action-btn" type="button" @click.stop="addManualSlot">
            <span aria-hidden="true">＋</span> 添加灯位
          </button>
          <button
            class="toolbar-action layout-action-btn"
            type="button"
            :disabled="layoutState.lamps.length <= 1"
            @click.stop="handleArrangeSlotsEvenly"
          >
            均匀排列
          </button>
        </div>

        <div class="view-mode-switch workbench-glass" role="group" aria-label="场景视角">
          <button
            class="view-mode-btn view-toggle-btn"
            :class="{ 'is-active': cameraViewMode === 'display' }"
            type="button"
            :aria-pressed="cameraViewMode === 'display'"
            @click.stop="setCameraViewMode('display')"
          >
            展示
          </button>
          <button
            class="view-mode-btn view-toggle-btn"
            :class="{ 'is-active': cameraViewMode === 'adjust' }"
            type="button"
            :aria-pressed="cameraViewMode === 'adjust'"
            @click.stop="setCameraViewMode('adjust')"
          >
            调节
          </button>
        </div>
      </div>

      <div class="scene-overlay" aria-hidden="true">
        <span>精品服装灯光</span>
        <small>轨道编排工作台</small>
      </div>

      <div ref="viewportRef" class="three-layout-viewport"></div>

      <div class="scene-context-layer" aria-live="polite" @pointerdown.stop>
        <div v-if="selectedSlot" class="scene-context-bar workbench-glass">
          <div class="selected-slot-summary">
            <span class="selection-dot" aria-hidden="true"></span>
            <span class="selected-slot-copy">
              <strong>{{ selectedSlotLabel }}</strong>
              <small v-if="selectedSlotStatusLabel">{{ selectedSlotStatusLabel }}</small>
            </span>
          </div>
          <div class="context-actions">
            <button
              class="context-action"
              type="button"
              aria-label="灯位左移"
              :disabled="!canMoveSelectedLeft"
              @click.stop="moveSelectedSlot(-1)"
            >
              ← 左移
            </button>
            <button
              class="context-action"
              type="button"
              aria-label="灯位右移"
              :disabled="!canMoveSelectedRight"
              @click.stop="moveSelectedSlot(1)"
            >
              右移 →
            </button>
            <span class="context-divider" aria-hidden="true"></span>
            <button
              class="context-action danger"
              type="button"
              :disabled="!canDeleteSelectedSlot"
              :title="deleteSlotTitle"
              @click.stop="deleteSelectedSlot"
            >
              删除
            </button>
          </div>
        </div>

        <div v-else class="scene-empty-hint workbench-glass">
          <strong>点击射灯后可编辑位置</strong>
          <small>拖动射灯调整陈列焦点</small>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 增加只读展示 computed**

Immediately after the existing `selectedSlotLabel` computed, insert:

```ts
const slotCountLabel = computed(() => `${layoutState.lamps.length} 个灯位`)
const selectedSlotStatusLabel = computed(() => {
  const slot = selectedSlot.value
  if (!slot) return ''
  if (slot.isManual) return '手动灯位'
  if (slot.online === true) return '在线'
  if (slot.online === false) return '离线'
  return ''
})
```

These computed values are display-only. Do not add watchers and do not write back to `layoutState`.

- [ ] **Step 5: 增加显式视角模式包装函数**

Immediately before the existing `toggleCameraView()` function, insert:

```ts
function setCameraViewMode(mode: CameraViewMode) {
  if (mode === cameraViewMode.value) return
  toggleCameraView()
}
```

Do not change `toggleCameraView()` or `animateCameraTo()`.

- [ ] **Step 6: 用桌面工作台 CSS 替换现有 scoped style**

Replace the complete existing `<style scoped>...</style>` block with:

```css
<style scoped>
.three-layout-shell {
  --workbench-blue: #2563eb;
  --workbench-blue-soft: rgba(37, 99, 235, 0.1);
  --workbench-gold: #c8a56c;
  --workbench-danger: #dc2626;
  --workbench-text: #0f172a;
  --workbench-muted: #64748b;
  --workbench-panel: rgba(255, 255, 255, 0.86);
  --workbench-border: rgba(148, 163, 184, 0.25);
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.three-viewport-wrap {
  position: relative;
  min-height: 430px;
  overflow: hidden;
  border: 1px solid var(--workbench-border);
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(239, 246, 255, 0.92)),
    radial-gradient(circle at 30% 20%, rgba(96, 165, 250, 0.18), transparent 32%);
}

.workbench-glass {
  border: 1px solid var(--workbench-border);
  background: var(--workbench-panel);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.13);
  backdrop-filter: blur(16px) saturate(130%);
}

.scene-toolbar {
  position: absolute;
  z-index: 4;
  top: 14px;
  right: 14px;
  left: 14px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.zone-cluster,
.scene-edit-actions,
.view-mode-switch {
  pointer-events: auto;
}

.zone-cluster {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  padding: 5px;
}

.zone-cluster::after {
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 12px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--workbench-gold), transparent);
  content: '';
  opacity: 0.78;
}

.zone-switcher {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.zone-arrow-btn {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--workbench-blue-soft);
  color: #2563eb;
  font-size: 20px;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.zone-current-label {
  display: flex;
  min-width: 116px;
  max-width: 154px;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  line-height: 1;
}

.zone-current-label strong {
  max-width: 100%;
  overflow: hidden;
  color: var(--workbench-text);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-current-label span {
  color: var(--workbench-muted);
  font-size: 11px;
  font-weight: 700;
}

.scene-edit-actions {
  display: inline-flex;
  justify-self: end;
  align-items: center;
  gap: 6px;
  border-radius: 16px;
  padding: 5px;
}

.scene-slot-count {
  padding: 0 6px;
  color: var(--workbench-muted);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.toolbar-divider,
.context-divider {
  width: 1px;
  height: 20px;
  background: var(--workbench-border);
}

.slot-toolbar button {
  color: #2563eb;
}

.toolbar-action {
  min-height: 32px;
  border: 0;
  border-radius: 10px;
  padding: 0 10px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.primary-action-btn {
  background: var(--workbench-blue);
  color: #fff;
  box-shadow: 0 7px 16px rgba(37, 99, 235, 0.22);
}

.layout-action-btn {
  background: var(--workbench-blue-soft);
}

.view-mode-switch {
  display: inline-flex;
  gap: 3px;
  border-radius: 14px;
  padding: 4px;
}

.view-toggle-btn {
  color: #2563eb;
}

.view-mode-btn {
  min-width: 48px;
  min-height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--workbench-muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.view-mode-btn.is-active {
  background: var(--workbench-blue);
  color: #fff;
  box-shadow: 0 7px 16px rgba(37, 99, 235, 0.2);
}

.scene-overlay {
  position: absolute;
  z-index: 2;
  top: 78px;
  left: 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  pointer-events: none;
  color: #fff1d6;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 12px rgba(48, 25, 9, 0.86);
}

.scene-overlay span {
  font-size: 13px;
  font-weight: 900;
}

.scene-overlay small {
  color: rgba(255, 241, 214, 0.78);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.scene-context-layer {
  position: absolute;
  z-index: 4;
  right: 14px;
  bottom: 14px;
  left: 14px;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.scene-context-bar {
  display: flex;
  max-width: min(680px, 100%);
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-radius: 18px;
  padding: 7px 8px 7px 12px;
  pointer-events: auto;
}

.selected-slot-summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.selection-dot {
  width: 8px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--workbench-blue);
  box-shadow: 0 0 16px rgba(37, 99, 235, 0.48);
}

.selected-slot-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.selected-slot-copy strong {
  overflow: hidden;
  color: var(--workbench-text);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-slot-copy small {
  color: var(--workbench-muted);
  font-size: 11px;
  font-weight: 700;
}

.context-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.context-action {
  min-height: 34px;
  border: 0;
  border-radius: 10px;
  padding: 0 10px;
  background: var(--workbench-blue-soft);
  color: var(--workbench-blue);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.context-action.danger {
  background: rgba(220, 38, 38, 0.08);
  color: var(--workbench-danger);
}

.scene-empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-radius: 15px;
  padding: 8px 14px;
  color: var(--workbench-text);
}

.scene-empty-hint strong {
  font-size: 12px;
  font-weight: 800;
}

.scene-empty-hint small {
  color: var(--workbench-muted);
  font-size: 10px;
  font-weight: 700;
}

.zone-arrow-btn:hover:not(:disabled),
.layout-action-btn:hover:not(:disabled),
.context-action:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.18);
  transform: translateY(-1px);
}

.primary-action-btn:hover:not(:disabled),
.view-mode-btn.is-active:hover {
  transform: translateY(-1px);
}

.context-action.danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.14);
}

.zone-arrow-btn:disabled,
.toolbar-action:disabled,
.context-action:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.zone-arrow-btn:focus-visible,
.toolbar-action:focus-visible,
.view-mode-btn:focus-visible,
.context-action:focus-visible {
  outline: 2px solid var(--workbench-blue);
  outline-offset: 2px;
}

.three-layout-viewport {
  width: 100%;
  height: 430px;
  min-height: 430px;
}

.three-layout-viewport :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.three-layout-viewport :deep(canvas:active) {
  cursor: grabbing;
}

@media (prefers-reduced-motion: reduce) {
  .zone-arrow-btn,
  .toolbar-action,
  .view-mode-btn,
  .context-action {
    transition: none;
  }
}
</style>
```

- [ ] **Step 7: 运行新测试和现有 Three 场景回归测试**

Run:

```bash
node --test tests/threeLightingWorkbenchUi.test.ts tests/threeLightingLayoutScene.test.ts
```

Expected: PASS; 9 tests pass and 0 fail. The existing scene test continues to find the compatibility selectors `.view-toggle-btn`, `.slot-toolbar button`, `.zone-arrow-btn`, `.scene-overlay`, and the reduced-motion rule.

- [ ] **Step 8: 只提交本任务新增 hunks**

```bash
git add tests/threeLightingWorkbenchUi.test.ts
git add -p src/components/device/ThreeLightingLayout.vue
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: add three scene workbench controls"
```

Expected before commit: the staged file list contains only `tests/threeLightingWorkbenchUi.test.ts` and `src/components/device/ThreeLightingLayout.vue`. In `git add -p`, accept only the template, two computed values, `setCameraViewMode`, and workbench CSS hunks introduced by this task; reject pre-existing boutique geometry, lamp material, brightness, Android, auth, dashboard, and settings hunks.

---

### Task 2: 增加夜间模式、平板与移动端布局

**Files:**
- Modify: `tests/threeLightingWorkbenchUi.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue: scoped CSS after canvas rules`
- Test: `tests/threeLightingWorkbenchUi.test.ts`

**Interfaces:**
- Consumes: Task 1 CSS variables and template classes `.three-layout-shell`, `.scene-toolbar`, `.zone-cluster`, `.scene-edit-actions`, `.view-mode-switch`, `.scene-context-bar`, `.scene-empty-hint`.
- Produces: night-mode variable overrides, the 1180px tablet layout, the 768px touch layout, and 44 × 44px mobile controls.

- [ ] **Step 1: 添加失败的主题与响应式契约测试**

Append this test inside the existing `describe(...)` block in `tests/threeLightingWorkbenchUi.test.ts`:

```ts
  it('defines night, tablet, mobile, touch, and reduced-motion states', () => {
    assert.match(component, /:global\(\.app-container\.night-mode\) \.three-layout-shell\s*\{/)
    assert.match(component, /@media \(max-width: 1180px\)/)
    assert.match(component, /@media \(max-width: 768px\)/)
    assert.match(component, /grid-template-areas:\s*"zone view"\s*"actions actions"/)
    assert.match(component, /@media \(max-width: 768px\)[\s\S]*min-width:\s*44px/)
    assert.match(component, /@media \(max-width: 768px\)[\s\S]*min-height:\s*44px/)
    assert.match(component, /@media \(max-width: 768px\)[\s\S]*\.scene-overlay\s*\{[^}]*display:\s*none/)
    assert.match(component, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition:\s*none/)
  })
```

- [ ] **Step 2: 运行测试并确认它因夜间模式缺失而失败**

Run:

```bash
node --test tests/threeLightingWorkbenchUi.test.ts
```

Expected: FAIL in `defines night, tablet, mobile, touch, and reduced-motion states`; the first missing match contains `.app-container.night-mode`.

- [ ] **Step 3: 增加主题与响应式 CSS**

Insert the following block immediately before the existing `@media (prefers-reduced-motion: reduce)` rule in `ThreeLightingLayout.vue`:

```css
:global(.app-container.night-mode) .three-layout-shell {
  --workbench-blue-soft: rgba(96, 165, 250, 0.15);
  --workbench-text: #f8fafc;
  --workbench-muted: #cbd5e1;
  --workbench-panel: rgba(15, 23, 42, 0.82);
  --workbench-border: rgba(148, 163, 184, 0.22);
}

:global(.app-container.night-mode) .three-viewport-wrap {
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.9)),
    radial-gradient(circle at 30% 20%, rgba(37, 99, 235, 0.18), transparent 32%);
}

:global(.app-container.night-mode) .workbench-glass {
  box-shadow: 0 14px 32px rgba(2, 6, 23, 0.34);
}

@media (max-width: 1180px) {
  .scene-toolbar {
    grid-template-columns: auto minmax(230px, 1fr) auto;
  }

  .scene-edit-actions {
    max-width: 100%;
    flex-wrap: wrap;
  }

  .scene-context-bar {
    width: min(620px, 100%);
  }
}

@media (max-width: 768px) {
  .three-viewport-wrap,
  .three-layout-viewport {
    min-height: 360px;
  }

  .three-layout-viewport {
    height: 360px;
  }

  .scene-toolbar {
    top: 10px;
    right: 10px;
    left: 10px;
    grid-template-areas:
      "zone view"
      "actions actions";
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .zone-cluster {
    grid-area: zone;
    min-width: 0;
    justify-self: stretch;
  }

  .zone-switcher {
    width: 100%;
    justify-content: space-between;
  }

  .zone-current-label {
    min-width: 0;
    max-width: 128px;
  }

  .view-mode-switch {
    grid-area: view;
  }

  .scene-edit-actions {
    grid-area: actions;
    width: 100%;
    box-sizing: border-box;
    justify-self: stretch;
    justify-content: flex-end;
  }

  .scene-slot-count {
    margin-right: auto;
  }

  .zone-arrow-btn,
  .view-mode-btn,
  .toolbar-action,
  .context-action {
    min-width: 44px;
    min-height: 44px;
  }

  .view-mode-btn {
    padding: 0 10px;
  }

  .scene-overlay {
    display: none;
  }

  .scene-context-layer {
    right: 10px;
    bottom: 10px;
    left: 10px;
  }

  .scene-context-bar {
    width: 100%;
    box-sizing: border-box;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
  }

  .selected-slot-summary {
    flex: 1 1 150px;
  }

  .context-actions {
    flex: 1 1 auto;
    justify-content: flex-end;
  }

  .scene-empty-hint {
    max-width: calc(100% - 20px);
    box-sizing: border-box;
  }
}
```

The existing reduced-motion rule from Task 1 remains unchanged and stays after these blocks.

- [ ] **Step 4: 运行 UI 契约测试**

Run:

```bash
node --test tests/threeLightingWorkbenchUi.test.ts
```

Expected: PASS; 5 tests pass and 0 fail.

- [ ] **Step 5: 运行生产构建检查类型与 scoped CSS**

Run:

```bash
npm run build
```

Expected: exit 0; `vue-tsc -b` reports no type errors and Vite writes a production bundle to `dist/`.

- [ ] **Step 6: 只提交响应式和主题 hunks**

```bash
git add tests/threeLightingWorkbenchUi.test.ts
git add -p src/components/device/ThreeLightingLayout.vue
git diff --cached --check
git diff --cached --name-only
git commit -m "style: make three workbench responsive"
```

Expected before commit: only the new responsive test and the night/tablet/mobile CSS block are staged. Reject any pre-existing non-workbench hunk.

---

### Task 3: 完整回归与视觉验收

**Files:**
- Verify: `src/components/device/ThreeLightingLayout.vue`
- Verify: `tests/threeLightingWorkbenchUi.test.ts`
- Verify: `tests/threeLightingLayoutScene.test.ts`

**Interfaces:**
- Consumes: the completed Task 1 and Task 2 workbench UI.
- Produces: verified desktop, tablet, mobile, night-mode, keyboard and interaction behavior with no product-code changes.

- [ ] **Step 1: 运行所有 Three 场景契约测试**

Run:

```bash
node --test tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts
```

Expected: PASS; 10 tests pass and 0 fail.

- [ ] **Step 2: 再次运行生产构建**

Run:

```bash
npm run build
```

Expected: exit 0; TypeScript and Vite production build complete without errors.

- [ ] **Step 3: 启动本地页面进行三档视口检查**

Run in a dedicated terminal:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, normally `http://127.0.0.1:5173/`. Open it with the existing authenticated local session and inspect these exact viewport sizes:

- 1366 × 900: three control groups remain on one line; the canvas stays 430px high; context controls do not cover the selected lamp.
- 1024 × 768: toolbar groups fit without horizontal overflow; region and view groups remain intact; context bar fits the card.
- 390 × 844: the first row is region plus view, the second row is count plus add/arrange, all controls are at least 44px, canvas stays 360px high, and the decorative overlay is hidden.

- [ ] **Step 4: 验证完整交互状态**

Perform these checks in order:

1. With no lamp selected, confirm only “点击射灯后可编辑位置 / 拖动射灯调整陈列焦点” appears at the bottom.
2. Select a real lamp and confirm its name plus online/offline state appears; delete remains disabled with the existing explanatory title.
3. Add a manual slot and confirm “手动灯位” appears; left/right availability follows its order; delete removes only that manual slot.
4. Switch between “展示” and “调节”; the pressed state changes immediately and clicking the active segment does nothing.
5. Change zones when more than one exists; when only one exists, both zone arrows remain disabled.
6. Drag a lamp on the canvas and confirm toolbar/context glass does not intercept canvas input outside the visible controls.
7. Enable night mode and confirm text, focus outline, blue selected state, gold rail line, and red delete state remain legible.
8. Tab through all controls and confirm focus order follows region → add/arrange → view → context actions.

Expected: every item passes without console errors, horizontal scrolling, hidden controls, or changes to saved layouts.

- [ ] **Step 5: 审查最终 diff 和提交边界**

Run:

```bash
git status --short
git diff --check
git log -3 --oneline
```

Expected: no whitespace errors; the two newest implementation commits are `feat: add three scene workbench controls` and `style: make three workbench responsive`. Existing unrelated dirty-worktree files remain untouched and unstaged.
