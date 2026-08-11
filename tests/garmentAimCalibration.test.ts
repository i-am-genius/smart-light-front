import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panelSource = readFileSync(
  new URL('../src/components/settings/GarmentAimCalibrationPanel.vue', import.meta.url),
  'utf8',
)
const apiSource = readFileSync(new URL('../src/api/device.ts', import.meta.url), 'utf8')
const dashboardSource = readFileSync(
  new URL('../src/views/SmartLightDashboard.vue', import.meta.url),
  'utf8',
)

test('settings page exposes the garment aiming calibration card', () => {
  assert.match(dashboardSource, /<GarmentAimCalibrationPanel/)
  assert.match(panelSource, /服装照射标定/)
  assert.match(panelSource, /拍摄并识别新位置/)
})

test('calibration flow records exact motor pose against latest recognition', () => {
  assert.match(panelSource, /addGarmentAimCalibrationSample/)
  assert.match(panelSource, /sendArmPosition/)
  assert.match(panelSource, /currentTargetSampled/)
  assert.match(panelSource, /照射正确，确认本次样本/)
})

test('frontend API supports status, sample creation and reset', () => {
  assert.match(apiSource, /getGarmentAimCalibration/)
  assert.match(apiSource, /garment-aim-calibration\/samples/)
  assert.match(apiSource, /clearGarmentAimCalibration/)
})
