import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const cameraCardSource = readFileSync(
  new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url),
  'utf8',
)

test('online camera loads persisted ROI without opening its detail modal', () => {
  assert.match(
    cameraCardSource,
    /watch\(\s*\(\) => \[props\.device\.chipId, props\.device\.online\] as const[\s\S]*?\(\[chipId, isOnline\]\) => \{[\s\S]*?if \(chipId && isOnline\) \{\s*void loadRoiConfig\(\)/,
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
