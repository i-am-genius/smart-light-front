import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  colorTemperatureToHex,
  resolveDisplayedColorTemperature,
} from '../src/utils/helpers.ts'

describe('layout color temperature', () => {
  it('uses restrained warm, neutral, and cool display anchors', () => {
    assert.equal(colorTemperatureToHex(2700), '#ffc084')
    assert.equal(colorTemperatureToHex(3500), '#ffdab2')
    assert.equal(colorTemperatureToHex(4500), '#fff0dc')
    assert.equal(colorTemperatureToHex(5500), '#f8faff')
    assert.equal(colorTemperatureToHex(6500), '#ebf2ff')
  })

  it('interpolates smoothly and clamps out-of-range temperatures', () => {
    assert.equal(colorTemperatureToHex(3100), '#ffcd9b')
    assert.equal(colorTemperatureToHex(1000), colorTemperatureToHex(2700))
    assert.equal(colorTemperatureToHex(9000), colorTemperatureToHex(6500))
  })

  it('prefers the actual lamp temperature even in auto mode', () => {
    assert.equal(resolveDisplayedColorTemperature(2700, 3500, true), 2700)
    assert.equal(resolveDisplayedColorTemperature('3100', 4200, true), 3100)
  })

  it('uses the recommendation only when auto mode has no actual reading', () => {
    assert.equal(resolveDisplayedColorTemperature(undefined, 3200, true), 3200)
    assert.equal(resolveDisplayedColorTemperature('', 3300, true), 3300)
    assert.equal(resolveDisplayedColorTemperature(undefined, 3300, false, 4000), 4000)
  })
})
