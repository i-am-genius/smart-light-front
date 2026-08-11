import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  colorTemperatureToHex,
  resolveDisplayedColorTemperature,
  resolveLayoutSpotIntensity,
} from '../src/utils/helpers.ts'

describe('layout color temperature', () => {
  it('keeps low color temperatures visibly warm after scene lighting', () => {
    assert.equal(colorTemperatureToHex(2700), '#ffae46')
    assert.equal(colorTemperatureToHex(3500), '#ffcf89')
    assert.equal(colorTemperatureToHex(4500), '#ffe9cf')
    assert.equal(colorTemperatureToHex(5500), '#f4f8ff')
    assert.equal(colorTemperatureToHex(6500), '#e2edff')
  })

  it('interpolates smoothly and clamps out-of-range temperatures', () => {
    assert.equal(colorTemperatureToHex(3100), '#ffbf68')
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

  it('limits simulated spotlight intensity so warm colors are not clipped to white', () => {
    assert.equal(resolveLayoutSpotIntensity(0), 0.7)
    assert.equal(resolveLayoutSpotIntensity(70), 7.14)
    assert.ok(Math.abs(resolveLayoutSpotIntensity(100) - 9.9) < 1e-10)
    assert.equal(resolveLayoutSpotIntensity(200), resolveLayoutSpotIntensity(100))
  })
})
