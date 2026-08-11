import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  colorTemperatureToHex,
  resolveDisplayedColorTemperature,
} from '../src/utils/helpers.ts'

describe('layout color temperature', () => {
  it('uses restrained warm, neutral, and cool display anchors', () => {
    assert.equal(colorTemperatureToHex(2700), '#ffb06a')
    assert.equal(colorTemperatureToHex(3500), '#ffcf9e')
    assert.equal(colorTemperatureToHex(4500), '#ffe9d2')
    assert.equal(colorTemperatureToHex(5500), '#f4f8ff')
    assert.equal(colorTemperatureToHex(6500), '#e2edff')
  })

  it('interpolates smoothly and clamps out-of-range temperatures', () => {
    assert.equal(colorTemperatureToHex(3100), '#ffc084')
    assert.equal(colorTemperatureToHex(1000), colorTemperatureToHex(2700))
    assert.equal(colorTemperatureToHex(9000), colorTemperatureToHex(6500))
  })

  it('uses the recommended temperature in auto mode', () => {
    assert.equal(resolveDisplayedColorTemperature(2700, 3500, true), 3500)
    assert.equal(resolveDisplayedColorTemperature('3100', 4200, true), 4200)
  })

  it('uses the actual temperature in manual mode and as the auto fallback', () => {
    assert.equal(resolveDisplayedColorTemperature(2700, 3500, false), 2700)
    assert.equal(resolveDisplayedColorTemperature(3100, undefined, true), 3100)
    assert.equal(resolveDisplayedColorTemperature(undefined, 3300, false, 4000), 4000)
  })
})
