import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getRefractionSceneBaseColor,
  getRelativeLuminance,
} from '../src/utils/sidebarRefraction.ts'

describe('sidebar refraction helpers', () => {
  it('keeps light refraction source luminance independent of vertical position', () => {
    const top = getRefractionSceneBaseColor(false, 0)
    const middle = getRefractionSceneBaseColor(false, 0.5)
    const bottom = getRefractionSceneBaseColor(false, 1)

    assert.equal(getRelativeLuminance(top), getRelativeLuminance(middle))
    assert.equal(getRelativeLuminance(middle), getRelativeLuminance(bottom))
  })

  it('keeps the static light source unchanged', () => {
    const color = getRefractionSceneBaseColor(false, 0, 'static')

    assert.deepEqual(color, { r: 255, g: 255, b: 255 })
  })

  it('uses a translucent-sidebar light base while dragging instead of pure white', () => {
    const color = getRefractionSceneBaseColor(false, 0, 'drag')

    assert.ok(color.r < 250)
    assert.ok(color.g < 250)
    assert.ok(color.b < 250)
    assert.ok(getRelativeLuminance(color) < 0.95)
  })

  it('keeps night refraction source luminance independent of vertical position', () => {
    const top = getRefractionSceneBaseColor(true, 0)
    const middle = getRefractionSceneBaseColor(true, 0.5)
    const bottom = getRefractionSceneBaseColor(true, 1)

    assert.equal(getRelativeLuminance(top), getRelativeLuminance(middle))
    assert.equal(getRelativeLuminance(middle), getRelativeLuminance(bottom))
  })
})
