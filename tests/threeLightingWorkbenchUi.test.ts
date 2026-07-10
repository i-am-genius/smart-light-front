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
    assert.match(component, /\.slot-toolbar \.primary-action-btn\s*\{[^}]*color:\s*#fff/)
    assert.match(component, /\.view-mode-btn\.is-active\s*\{[^}]*background:\s*var\(--workbench-blue\)/)
    assert.match(component, /\.context-action\.danger\s*\{[^}]*color:\s*var\(--workbench-danger\)/)
    assert.match(component, /\.scene-context-layer\s*\{[^}]*pointer-events:\s*none/)
    assert.match(component, /\.scene-context-bar\s*\{[^}]*pointer-events:\s*auto/)
    assert.match(component, /\.scene-overlay\s*\{[^}]*pointer-events:\s*none/)
  })
})
