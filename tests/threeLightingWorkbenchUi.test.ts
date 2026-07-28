import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { compileStyle, parse } from '@vue/compiler-sfc'

const component = readFileSync(
  new URL('../src/components/device/ThreeLightingLayout.vue', import.meta.url),
  'utf8',
)
const { descriptor } = parse(component, { filename: 'ThreeLightingLayout.vue' })
const compiledStyle = compileStyle({
  filename: 'ThreeLightingLayout.vue',
  id: 'data-v-three-lighting-workbench-test',
  scoped: true,
  source: descriptor.styles[0]?.content ?? '',
})

function buttonOpeningTag(attribute: string, value: string) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = component.match(
    new RegExp(`<button(?=[^>]*${attribute}="${escapedValue}")[^>]*>`),
  )
  assert.ok(match, `expected button with ${attribute}="${value}"`)
  return match[0]
}

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

  it('does not manufacture lamp slots beyond real devices and explicit manual slots', () => {
    assert.doesNotMatch(component, /MIN_VISIBLE_SLOTS/)
    assert.doesNotMatch(component, /function ensureMinVisibleSlots\(/)
    assert.doesNotMatch(component, /placeholder-\$\{zoneId\}/)
    assert.doesNotMatch(component, /mock-fallback/)
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
    assert.match(
      component,
      /\.zone-cluster,\s*\.scene-edit-actions,\s*\.view-mode-switch\s*\{[^}]*pointer-events:\s*none/,
    )
    assert.match(component, /\.scene-context-bar\s*\{[^}]*pointer-events:\s*none/)
    assert.match(
      component,
      /\.zone-cluster button,\s*\.scene-edit-actions button,\s*\.view-mode-switch button,\s*\.scene-context-bar button\s*\{[^}]*pointer-events:\s*auto/,
    )
    assert.doesNotMatch(component, /\.scene-overlay/)
  })

  it('compacts the narrow toolbar into one row', () => {
    assert.match(component, /\.three-layout-shell\s*\{[^}]*container-type:\s*inline-size/)
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
      /@media\s*\(max-width:\s*768px\)[\s\S]*?\.zone-arrow-btn,[\s\S]*?min-height:\s*40px/,
    )
  })

  it('keeps the full narrow zone name visible while preserving space for right-side actions', () => {
    assert.match(
      component,
      /@container\s*\(max-width:\s*620px\)\s*\{[\s\S]*?\.scene-toolbar\s*\{[^}]*grid-template-columns:\s*38%\s+minmax\(0,\s*1fr\)\s+auto/,
    )
    assert.doesNotMatch(
      component,
      /@container\s*\(max-width:\s*620px\)\s*\{[\s\S]*?\.scene-toolbar\s*\{[^}]*grid-template-columns:\s*(?:clamp\(|minmax\([^)]*px)/,
    )
    assert.match(component, /--zone-name-length/)
    assert.match(
      component,
      /@container\s*\(max-width:\s*620px\)[\s\S]*?\.zone-current-label\s*\{[^}]*container-type:\s*inline-size[^}]*flex:\s*1[^}]*max-width:\s*none/,
    )
    const mobileZoneNameRule = component.match(
      /@container\s*\(max-width:\s*620px\)[\s\S]*?\.zone-current-label strong\s*\{([^}]*)\}/,
    )?.[1]
    assert.ok(mobileZoneNameRule)
    assert.match(mobileZoneNameRule, /font-size:\s*clamp\(10px,\s*calc\([^;]*cqi[^;]*--zone-name-length[^;]*\),\s*13px\)/)
    assert.match(mobileZoneNameRule, /overflow:\s*hidden/)
    assert.match(mobileZoneNameRule, /text-overflow:\s*ellipsis/)
  })

  it('uses full action labels when the mobile toolbar has enough inline space', () => {
    assert.match(
      component,
      /@container\s*\(min-width:\s*22rem\)\s*and\s*\(max-width:\s*38\.75rem\)[\s\S]*?\.layout-action-btn \.toolbar-label-full,[\s\S]*?\.view-mode-btn \.toolbar-label-full\s*\{[^}]*display:\s*inline/,
    )
    assert.match(
      component,
      /@container\s*\(min-width:\s*22rem\)\s*and\s*\(max-width:\s*38\.75rem\)[\s\S]*?\.layout-action-btn \.toolbar-label-compact,[\s\S]*?\.view-mode-btn \.toolbar-label-compact\s*\{[^}]*display:\s*none/,
    )
    assert.match(
      component,
      /@container\s*\(max-width:\s*22rem\)[\s\S]*?\.zone-switcher \.zone-arrow-btn\s*\{[^}]*width:\s*1\.5rem;[^}]*min-width:\s*1\.5rem/,
    )
    assert.match(
      component,
      /@container\s*\(min-width:\s*22rem\)\s*and\s*\(max-width:\s*38\.75rem\)[\s\S]*?\.layout-action-btn,\s*\.view-mode-switch \.view-mode-btn\s*\{[^}]*padding-right:\s*0\.375rem;[^}]*padding-left:\s*0\.375rem/,
    )
  })

  it('defines night, tablet, mobile touch, and reduced-motion states', () => {
    assert.match(component, /@media \(max-width: 1180px\)/)
    assert.match(component, /@media \(max-width: 768px\)/)
    assert.match(
      component,
      /@media \(max-width: 768px\)[\s\S]*?\.context-action\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/,
    )
    assert.match(component, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition:\s*none/)
  })

  it('keeps desktop toolbar controls at least 34px high', () => {
    assert.match(component, /\.zone-arrow-btn\s*\{[^}]*(?:height|min-height):\s*34px/)
    assert.match(component, /\.toolbar-action\s*\{[^}]*min-height:\s*34px/)
  })

  it('explains why navigation and layout commands are disabled', () => {
    assert.match(
      buttonOpeningTag('aria-label', '上一个区域'),
      /:title="zoneCount <= 1 \? '当前仅一个区域' : '上一个区域'"/,
    )
    assert.match(
      buttonOpeningTag('aria-label', '下一个区域'),
      /:title="zoneCount <= 1 \? '当前仅一个区域' : '下一个区域'"/,
    )
    assert.match(
      buttonOpeningTag('class', 'toolbar-action layout-action-btn'),
      /:title="layoutState\.lamps\.length <= 1 \? '至少两个灯位' : '均匀排列'"/,
    )
    assert.match(
      buttonOpeningTag('aria-label', '灯位左移'),
      /:title="canMoveSelectedLeft \? '左移' : '已在最左'"/,
    )
    assert.match(
      buttonOpeningTag('aria-label', '灯位右移'),
      /:title="canMoveSelectedRight \? '右移' : '已在最右'"/,
    )
  })

  it('keeps night mode selectors scoped to workbench descendants', () => {
    assert.deepEqual(compiledStyle.errors, [])
    assert.match(compiledStyle.code, /\.app-container\.night-mode \.three-layout-shell\s*\{/)
    for (const selector of [
      'three-viewport-wrap',
      'workbench-glass',
      'zone-arrow-btn',
      'layout-action-btn',
      'context-action',
    ]) {
      assert.match(
        compiledStyle.code,
        new RegExp(`\\.app-container\\.night-mode \\.three-layout-shell \\.${selector}[^,{]*\\s*\\{`),
      )
    }
    assert.doesNotMatch(
      compiledStyle.code,
      /\.app-container\.night-mode \.(?:three-viewport-wrap|workbench-glass|zone-arrow-btn|layout-action-btn|context-action)/,
    )
  })

  it('uses solid high-contrast colours for night mode actions', () => {
    assert.match(
      compiledStyle.code,
      /\.app-container\.night-mode \.three-layout-shell \.zone-arrow-btn\s*\{[^}]*background:\s*#2563eb;[^}]*color:\s*#fff;/,
    )
    assert.match(
      compiledStyle.code,
      /\.app-container\.night-mode \.three-layout-shell \.layout-action-btn\s*\{[^}]*background:\s*#2563eb;[^}]*color:\s*#fff;/,
    )
    assert.match(
      compiledStyle.code,
      /\.app-container\.night-mode \.three-layout-shell \.context-action\s*\{[^}]*background:\s*#2563eb;[^}]*color:\s*#fff;/,
    )
    assert.match(
      compiledStyle.code,
      /\.app-container\.night-mode \.three-layout-shell \.context-action\.danger\s*\{[^}]*background:\s*#dc2626;[^}]*color:\s*#fff;/,
    )
  })
})
