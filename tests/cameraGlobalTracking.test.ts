import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const component = readFileSync(
  new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url),
  'utf8',
)
const api = readFileSync(
  new URL('../src/api/device.ts', import.meta.url),
  'utf8',
)

describe('camera global tracking', () => {
  it('defines explicit global start and stop API calls', () => {
    assert.match(api, /export async function startCamGlobalTracking/)
    assert.match(api, /\/admin\/device\/cam\/tracking\/global\/start/)
    assert.match(api, /export async function stopCamGlobalTracking/)
    assert.match(api, /\/admin\/device\/cam\/tracking\/global\/stop/)
  })

  it('renders the global tracking button immediately before batch capture', () => {
    assert.match(component, /global-tracking-btn[\s\S]*batch-capture-btn/)
    assert.match(component, /isGlobalTracking \? '停止全局跟踪' : '全局跟踪'/)
  })

  it('does not require the slider lamp for global tracking', () => {
    const guard = component.match(
      /const globalTrackingDisabledReason[\s\S]*?\n}\)/,
    )?.[0] ?? ''

    assert.doesNotMatch(guard, /sliderLampChipId|滑轨控制灯/)
    assert.match(guard, /三个目标灯/)
  })
})
