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

describe('camera manual tracking', () => {
  it('defines explicit start and stop API calls', () => {
    assert.match(api, /export async function startCamTracking/)
    assert.match(api, /\/admin\/device\/cam\/tracking\/start/)
    assert.match(api, /export async function stopCamTracking/)
    assert.match(api, /\/admin\/device\/cam\/tracking\/stop/)
  })

  it('renders the tracking control below capture control', () => {
    assert.match(component, /area-capture-btn[\s\S]*area-tracking-btn/)
    assert.match(component, /isTargetTracking\(area\.targetButton\) \? '停止' : '跟踪'/)
  })

  it('does not use presence or cloth state as a manual tracking guard', () => {
    const guard = component.match(
      /function getTrackingButtonDisabledReason[\s\S]*?\n}/,
    )?.[0] ?? ''

    assert.doesNotMatch(guard, /present|trackingReady|isLampClothTaken/)
  })

  it('starts tracking without requiring slider alignment', () => {
    const guard = component.match(
      /function getTrackingButtonDisabledReason[\s\S]*?\n}/,
    )?.[0] ?? ''

    assert.doesNotMatch(guard, /sliderLamp|滑轨/)
  })
})
