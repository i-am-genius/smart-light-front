import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearOfflineArmPositions,
  createZeroArmPosition,
  readDeviceArmPosition,
  saveDeviceArmPosition,
  type ArmPosition,
} from '../src/utils/armPositionState.ts'

test('stores precision positions independently for each device', () => {
  const positions = new Map<string, ArmPosition>()

  saveDeviceArmPosition(positions, 'lamp-1', { pan: 10, tilt: 0, slider: 0 })

  assert.deepEqual(readDeviceArmPosition(positions, 'lamp-1', true), {
    pan: 10,
    tilt: 0,
    slider: 0,
  })
  assert.deepEqual(readDeviceArmPosition(positions, 'lamp-2', true), createZeroArmPosition())
})

test('returns copies so editing one current position cannot mutate another device', () => {
  const positions = new Map<string, ArmPosition>()
  saveDeviceArmPosition(positions, 'lamp-1', { pan: 10, tilt: -5, slider: 100 })

  const current = readDeviceArmPosition(positions, 'lamp-1', true)
  current.pan = 20

  assert.equal(readDeviceArmPosition(positions, 'lamp-1', true).pan, 10)
})

test('offline devices resolve to zero and lose their cached position', () => {
  const positions = new Map<string, ArmPosition>()
  saveDeviceArmPosition(positions, 'lamp-1', { pan: 10, tilt: -5, slider: 100 })
  saveDeviceArmPosition(positions, 'lamp-2', { pan: -20, tilt: 15, slider: 300 })

  const cleared = clearOfflineArmPositions(positions, [
    { code: 'lamp-1', online: false },
    { code: 'lamp-2', online: true },
  ])

  assert.deepEqual(cleared, ['lamp-1'])
  assert.deepEqual(readDeviceArmPosition(positions, 'lamp-1', false), createZeroArmPosition())
  assert.deepEqual(readDeviceArmPosition(positions, 'lamp-1', true), createZeroArmPosition())
  assert.deepEqual(readDeviceArmPosition(positions, 'lamp-2', true), {
    pan: -20,
    tilt: 15,
    slider: 300,
  })
})
