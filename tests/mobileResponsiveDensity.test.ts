import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const mobileViewports = [360, 393, 412, 430] as const

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const lamp = source('../src/components/device/LampDeviceCard.vue')
const camera = source('../src/components/device/CameraDeviceCard.vue')
const three = source('../src/components/device/ThreeLightingLayout.vue')
const arm = source('../src/components/settings/ArmControlPanel.vue')
const effect = source('../src/components/device/LightEffectMiniPanel.vue')
const modal = source('../src/components/device/DeviceAddModal.vue')
const dashboard = source('../src/views/SmartLightDashboard.vue')
const store = source('../src/components/settings/StoreSettingsPanel.vue')
const smartConfig = source('../src/components/settings/SmartConfigPanel.vue')
const flow = source('../src/components/settings/FlowMonitorPanel.vue')

describe('mobile responsive density contract', () => {
  it('covers the mainstream phone viewport widths', () => {
    assert.deepEqual(mobileViewports, [360, 393, 412, 430])
  })

  it('compacts lamp and camera cards without removing touch-friendly controls', () => {
    for (const component of [lamp, camera]) {
      assert.match(component, /@media\s*\(max-width:\s*768px\)/)
      assert.match(component, /padding:\s*clamp\([^;]*\)/)
      assert.match(component, /font-size:\s*16px/)
      assert.match(component, /min-height:\s*44px/)
    }
  })

  it('caps the three scene by available width instead of a fixed 360px mobile height', () => {
    assert.match(three, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.three-layout-viewport[\s\S]*?height:\s*clamp\(/)
    assert.match(three, /aspect-ratio:\s*16\s*\/\s*10/)
    assert.doesNotMatch(three, /@media\s*\(max-width:\s*768px\)[\s\S]*?height:\s*360px/)
    assert.match(
      three,
      /@container\s*\(max-width:\s*620px\)[\s\S]*?\.scene-edit-actions\s*\{[^}]*flex-wrap:\s*nowrap/,
    )
    assert.match(
      three,
      /@container\s*\(max-width:\s*620px\)[\s\S]*?\.layout-action-btn\s*\{[^}]*white-space:\s*nowrap/,
    )
  })

  it('sizes the joystick from the phone width while keeping a bounded maximum', () => {
    assert.match(arm, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.joystick-side[\s\S]*?width:\s*clamp\(/)
    assert.match(arm, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.joystick-container[\s\S]*?width:\s*clamp\(/)
    assert.match(arm, /max-width:\s*172px/)
  })

  it('keeps the light effect panel dense on narrow screens', () => {
    assert.match(effect, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.light-effect-mini-card[\s\S]*?padding:\s*clamp\(/)
    assert.match(
      effect,
      /@media\s*\(max-width:\s*768px\)[\s\S]*?\.effect-action-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    )
    assert.match(effect, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.effect-action-btn[\s\S]*?min-height:\s*clamp\(/)
  })

  it('keeps the four gimbal presets in a 2 by 2 phone grid', () => {
    assert.match(
      arm,
      /@media\s*\(max-width:\s*480px\)[\s\S]*?\.gimbal-preset-side\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    )
    assert.doesNotMatch(
      arm,
      /@media\s*\(max-width:\s*480px\)[\s\S]*?\.gimbal-preset-side\s*\{[^}]*grid-template-columns:\s*1fr/,
    )
  })

  it('contains the three scene and forces compact toolbar labels on phones', () => {
    assert.match(three, /\.three-layout-shell\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%[^}]*min-width:\s*0/)
    assert.match(three, /\.three-viewport-wrap\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%[^}]*box-sizing:\s*border-box/)
    assert.match(three, /\.three-layout-viewport\s+:deep\(canvas\)\s*\{[^}]*max-width:\s*100%/)
    assert.match(three, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.zone-arrow-btn,[\s\S]*?\.toolbar-action\s*\{[^}]*min-width:\s*40px[^}]*min-height:\s*40px/)
    assert.match(three, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.primary-action-btn\s*\{[^}]*width:\s*44px[^}]*min-width:\s*44px[^}]*min-height:\s*44px/)
    assert.match(three, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.zone-manager-btn\s*\{[^}]*width:\s*40px[^}]*height:\s*40px/)
    assert.match(three, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.zone-name-input\s*\{[^}]*height:\s*40px/)
    assert.match(three, /@media\s*\(max-width:\s*380px\)[\s\S]*?grid-template-areas:\s*"zone zone view"\s*"actions actions actions"/)
    assert.match(
      three,
      /@media\s*\(max-width:\s*480px\)[\s\S]*?\.toolbar-label-full\s*\{[^}]*display:\s*none[^}]*\}[\s\S]*?\.toolbar-label-compact\s*\{[^}]*display:\s*inline/,
    )
  })

  it('reduces realtime and settings section whitespace on phones', () => {
    assert.match(dashboard, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.env-card\s*\{[^}]*padding:\s*8px\s+12px/)
    assert.match(dashboard, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.stat-item\s*\{[^}]*padding:\s*2px\s+4px/)
    assert.match(dashboard, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.settings-layout\s*\{[^}]*gap:\s*0/)
    assert.match(dashboard, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.settings-group-card\s*\{[^}]*margin-top:\s*8px/)
    assert.match(dashboard, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.settings-group-title\s*\{[^}]*margin-bottom:\s*8px[^}]*padding-bottom:\s*6px/)
    assert.match(store, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.store-toolbar-card\s*\{[^}]*padding:\s*10px\s+12px/)
  })

  it('compacts gimbal, SmartConfig, and flow panels without shrinking primary controls away', () => {
    assert.match(arm, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.joystick-section\s*\{[^}]*margin-top:\s*10px/)
    assert.match(arm, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.preset-card\s*\{[^}]*min-height:\s*56px/)
    assert.match(smartConfig, /@media\s*\(max-width:\s*599px\)[\s\S]*?\.smart-card\s*\{[^}]*padding:\s*10px\s+12px/)
    assert.match(smartConfig, /@media\s*\(max-width:\s*599px\)[\s\S]*?\.wifi-row,[\s\S]*?\.password-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
    assert.match(flow, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.detect-upload-card\s*\{[^}]*padding:\s*10px\s+12px/)
    assert.match(flow, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.detect-placeholder\s*\{[^}]*height:\s*120px/)
  })

  it('constrains the add-device modal to the visual viewport and scrolls its content', () => {
    assert.match(modal, /max-height:\s*calc\(100dvh\s*-\s*24px\)/)
    assert.match(modal, /overflow-y:\s*auto/)
    assert.match(modal, /overscroll-behavior:\s*contain/)
  })
})
