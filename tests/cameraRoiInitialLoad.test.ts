import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const cameraCardSource = readFileSync(
  new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url),
  'utf8',
)

test('camera loads persisted ROI without requiring the tracking node to be online', () => {
  assert.match(
    cameraCardSource,
    /watch\(\s*\(\) => props\.device\.chipId[\s\S]*?\(chipId\) => \{[\s\S]*?if \(chipId\) \{\s*void loadRoiConfig\(\)/,
  )
  assert.match(
    cameraCardSource,
    /\{ immediate: true \},\s*\)/,
  )
})

test('camera card does not report ROI as unconfigured while the initial request is pending', () => {
  assert.match(
    cameraCardSource,
    /const roiWarningText = computed\(\(\) => \{\s*if \(!props\.device\.online\) return ''\s*if \(roiLoading\.value\) return ''/,
  )
})

test('opening camera details can still refresh ROI explicitly', () => {
  assert.match(
    cameraCardSource,
    /function openDetailModal\(\) \{[\s\S]*?void loadRoiConfig\(\)/,
  )
})

test('last capture summary names the selected lamp instead of exposing an ROI index', () => {
  assert.match(
    cameraCardSource,
    /const lastCaptureSummaryText = computed\([\s\S]*?capture\.targetChipId[\s\S]*?getTargetLabelByChipId/,
  )
  assert.doesNotMatch(
    cameraCardSource,
    /const lastCaptureSummaryText = computed\([\s\S]*?`区域 \$\{capture\.targetIndex\}`/,
  )
})
