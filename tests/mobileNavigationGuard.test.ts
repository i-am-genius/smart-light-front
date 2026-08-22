import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const dashboard = readFileSync(
  new URL('../src/views/SmartLightDashboard.vue', import.meta.url),
  'utf8',
)
const armControl = readFileSync(
  new URL('../src/components/settings/ArmControlPanel.vue', import.meta.url),
  'utf8',
)
const threeLightingLayout = readFileSync(
  new URL('../src/components/device/ThreeLightingLayout.vue', import.meta.url),
  'utf8',
)
const mainActivity = readFileSync(
  new URL('../android/app/src/main/java/com/genius/smartlight/MainActivity.java', import.meta.url),
  'utf8',
)

describe('mobile navigation gesture guards', () => {
  it('does not start page swipes from controls or explicit drag surfaces', () => {
    assert.match(dashboard, /function shouldBlockPageSwipe\(target: EventTarget \| null\)/)
    assert.match(dashboard, /input, select, textarea, button, a/)
    assert.match(dashboard, /\[role="slider"\]/)
    assert.match(dashboard, /\[role="switch"\]/)
    assert.match(dashboard, /\[data-page-swipe-lock\]/)
    assert.match(dashboard, /if \(shouldBlockPageSwipe\(e\.target\)\) return/)
    assert.match(armControl, /class="joystick-container"[\s\S]{0,180}data-page-swipe-lock/)
    assert.match(threeLightingLayout, /class="three-layout-viewport" data-page-swipe-lock/)
  })

  it('lets the web layer consume back before Android exits', () => {
    assert.match(mainActivity, /OnBackPressedCallback/)
    assert.match(mainActivity, /smartlight-native-back/)
    assert.match(mainActivity, /cancelable:\s*true/)
    assert.match(mainActivity, /webView\.canGoBack\(\)/)
    assert.match(mainActivity, /BACK_EXIT_INTERVAL_MS/)
    assert.match(mainActivity, /再按一次退出应用/)
    assert.match(dashboard, /window\.addEventListener\(NATIVE_BACK_EVENT, handleNativeBack\)/)
    assert.match(dashboard, /window\.removeEventListener\(NATIVE_BACK_EVENT, handleNativeBack\)/)
    assert.match(dashboard, /if \(activeTab\.value !== 'main'\)/)
    assert.match(dashboard, /event\.preventDefault\(\)/)
  })
})
