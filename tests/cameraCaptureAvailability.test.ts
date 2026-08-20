import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync(
  new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url),
  'utf8',
)
const disabledReason = source.match(
  /function getTargetButtonDisabledReason[\s\S]*?\n}/,
)?.[0] ?? ''

describe('camera capture availability', () => {
  it('does not depend on the target lamp online state', () => {
    assert.doesNotMatch(source, /targetOnline/)
    assert.doesNotMatch(disabledReason, /目标灯离线/)
  })

  it('uses the bound capture controller instead of tracking camera online state', () => {
    assert.doesNotMatch(disabledReason, /!props\.device\.online/)
    assert.match(disabledReason, /captureControllerDisabledReason\.value/)
  })

  it('keeps busy and target identity guards', () => {
    assert.match(disabledReason, /isCamBusy\.value/)
    assert.match(disabledReason, /!target\.targetChipId/)
    assert.match(disabledReason, /target\.targetMissing/)
  })
})
