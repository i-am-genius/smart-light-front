import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { isCaptureControllerDevice } from '../src/utils/device.ts'

const cameraCardSource = readFileSync(
  new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url),
  'utf8',
)
const deviceCardSource = readFileSync(
  new URL('../src/components/device/DeviceCard.vue', import.meta.url),
  'utf8',
)
const addModalSource = readFileSync(
  new URL('../src/components/device/DeviceAddModal.vue', import.meta.url),
  'utf8',
)
const smartLightingSource = readFileSync(
  new URL('../src/components/device/SmartLightingButton.vue', import.meta.url),
  'utf8',
)

describe('camera capture controller binding', () => {
  it('classifies cam_capture independently from camera and lamp devices', () => {
    assert.equal(isCaptureControllerDevice({ deviceType: 'cam_capture' }), true)
    assert.equal(isCaptureControllerDevice({ deviceType: 'cam-capture' }), true)
    assert.equal(isCaptureControllerDevice({ deviceType: 'cam' }), false)
    assert.equal(isCaptureControllerDevice({ deviceType: 'lamp' }), false)
  })

  it('exposes capture controllers to the camera card and add-device modal', () => {
    assert.match(deviceCardSource, /:capture-controller-devices="captureControllerDevices"/)
    assert.match(deviceCardSource, /filter\(isCaptureControllerDevice\)/)
    assert.match(addModalSource, /拍照控制器（cam_capture）/)
  })

  it('persists the binding and sends manual PTZ to the bound controller', () => {
    assert.match(cameraCardSource, /roiDraft\.captureControllerChipId/)
    assert.match(cameraCardSource, /captureControllerDevice/)
    assert.match(cameraCardSource, /chipId:\s*(?:captureControllerDevice\.value|controller)\.chipId/)
  })

  it('lets capture flows depend on the capture controller rather than tracking camera online state', () => {
    assert.doesNotMatch(smartLightingSource, /if\s*\(!camera\.online\)/)
    assert.match(smartLightingSource, /!roi\.captureControllerChipId/)
    assert.match(smartLightingSource, /captureController\.online/)
  })
})
