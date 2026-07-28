import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAX_SHADOW_CASTING_SPOTS,
  selectSpotShadowSlotIds,
} from '../src/components/device/threeSpotShadowBudget.ts'

describe('spot shadow budget', () => {
  it('selects at most four real or explicitly bound lamp slots in stable order', () => {
    const shadowIds = selectSpotShadowSlotIds([
      { slotId: 'chip-only-camera', order: -3, chipId: 'camera-chip' },
      { slotId: 'chip-only-placeholder', order: -2, chipId: 'placeholder-chip' },
      { slotId: 'late', order: 3, boundLampDeviceId: 'lamp-late' },
      { slotId: 'manual-unbound', order: -1, isManual: true },
      { slotId: 'first-a', order: 0, sourceDeviceId: 11 },
      { slotId: 'first-b', order: 0, deviceId: 12 },
      { slotId: 'bound-manual', order: 1, isManual: true, boundLampDeviceId: 'lamp-13' },
      { slotId: 'fifth', order: 2, sourceDeviceId: 'device-fifth' },
    ], '')

    assert.equal(MAX_SHADOW_CASTING_SPOTS, 4)
    assert.deepEqual([...shadowIds], ['first-a', 'first-b', 'bound-manual', 'fifth'])
    assert.equal(shadowIds.has('manual-unbound'), false)
    assert.equal(shadowIds.has('chip-only-camera'), false)
    assert.equal(shadowIds.has('chip-only-placeholder'), false)
    assert.equal(shadowIds.has('late'), false)
  })

  it('prioritises a selected eligible real lamp without admitting a selected placeholder', () => {
    const slots = [
      { slotId: 'one', order: 0, sourceDeviceId: 'device-1' },
      { slotId: 'two', order: 1, sourceDeviceId: 'device-2' },
      { slotId: 'three', order: 2, sourceDeviceId: 'device-3' },
      { slotId: 'four', order: 3, sourceDeviceId: 'device-4' },
      { slotId: 'five', order: 4, sourceDeviceId: 'device-5' },
      { slotId: 'manual-unbound', order: -1, isManual: true },
    ]

    assert.deepEqual(
      [...selectSpotShadowSlotIds(slots, 'five')],
      ['five', 'one', 'two', 'three'],
    )
    assert.deepEqual(
      [...selectSpotShadowSlotIds(slots, 'manual-unbound')],
      ['one', 'two', 'three', 'four'],
    )
  })
})
