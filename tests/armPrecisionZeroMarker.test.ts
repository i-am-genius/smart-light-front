import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panelSource = readFileSync(
  new URL('../src/components/settings/ArmControlPanel.vue', import.meta.url),
  'utf8',
)

test('Pan and Tilt precision controls expose an explicit clickable zero point', () => {
  assert.equal((panelSource.match(/class="precision-zero-marker"/g) || []).length, 2)
  assert.match(panelSource, /aria-label="Pan 回到 0°"/)
  assert.match(panelSource, /aria-label="Tilt 回到 0°"/)
  assert.match(panelSource, /@click="resetPrecisionAxis\('pan'\)"/)
  assert.match(panelSource, /@click="resetPrecisionAxis\('tilt'\)"/)
})

test('zero-point action persists and sends the selected axis only', () => {
  assert.match(
    panelSource,
    /function resetPrecisionAxis\(field: 'pan' \| 'tilt'\)[\s\S]*?armPosition\[field\] = 0[\s\S]*?saveDeviceArmPosition[\s\S]*?doSendPosition\(\{ \[field\]: 0 \}\)/,
  )
})
