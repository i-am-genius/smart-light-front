import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const component = readFileSync(
  new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url),
  'utf8',
)

describe('camera tracking and capture capabilities', () => {
  it('marks the camera card online when either physical camera capability is online', () => {
    assert.match(component, /const trackingCameraOnline = computed/)
    assert.match(component, /const captureControllerOnline = computed/)
    assert.match(
      component,
      /const cameraCardOnline = computed\(\(\) =>\s*trackingCameraOnline\.value \|\| captureControllerOnline\.value\s*\)/,
    )
    assert.match(component, /'is-online': cameraCardOnline/)
    assert.match(component, /status-badge[^>]*:class="\{ online: cameraCardOnline/)
  })

  it('uses only capture activity to disable capture controls', () => {
    const captureBusy = component.match(
      /const isCaptureBusy = computed\([\s\S]*?\n\}\)/,
    )?.[0] ?? ''
    const captureGuard = component.match(
      /function getTargetButtonDisabledReason[\s\S]*?\n\}/,
    )?.[0] ?? ''

    assert.match(captureBusy, /waiting_motion/)
    assert.match(captureBusy, /capturing/)
    assert.match(captureBusy, /localCapturePending\.value/)
    assert.doesNotMatch(captureBusy, /ready_tracking|tracking/)
    assert.match(captureGuard, /isCaptureBusy\.value/)
    assert.doesNotMatch(captureGuard, /trackingCameraOnline/)
  })

  it('uses only the tracking camera online state to disable tracking controls', () => {
    const trackingGuard = component.match(
      /function getTrackingButtonDisabledReason[\s\S]*?\n\}/,
    )?.[0] ?? ''

    assert.match(trackingGuard, /!trackingCameraOnline\.value/)
    assert.doesNotMatch(trackingGuard, /captureControllerDisabledReason|isCaptureBusy/)
    assert.doesNotMatch(trackingGuard, /sliderLamp|滑轨/)
  })
})
