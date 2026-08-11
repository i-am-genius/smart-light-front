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

test('settings cards stay aligned and SmartConfig is placed after data analysis', () => {
  const deviceGridIndex = dashboardSource.indexOf('settings-device-grid')
  const dataGridIndex = dashboardSource.indexOf('settings-data-grid')
  const smartConfigIndex = dashboardSource.lastIndexOf('<SmartConfigPanel')

  assert.ok(deviceGridIndex >= 0)
  assert.ok(dataGridIndex > deviceGridIndex)
  assert.ok(smartConfigIndex > dataGridIndex)
  assert.match(dashboardSource, /\.settings-device-grid :deep\(\.settings-card\)[\s\S]*?height:\s*100%/)
  assert.match(dashboardSource, /\.settings-data-grid[\s\S]*?grid-auto-rows:\s*clamp\(/)
  assert.match(dashboardSource, /\.settings-duration-slot :deep\(\.result-block\)[\s\S]*?overflow:\s*auto/)
})

test('ROI status is hidden without hiding the people-flow chart', () => {
  assert.match(dashboardSource, /\.flow-presence-list/)
  assert.match(dashboardSource, /\.flow-roi-warning/)
  assert.doesNotMatch(
    dashboardSource,
    /\.settings-flow-slot :deep\(\.flow-chart-box\)[^{]*\{[^}]*display:\s*none/s,
  )
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
