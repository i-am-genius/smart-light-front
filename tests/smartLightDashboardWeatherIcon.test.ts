import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync(new URL('../src/views/SmartLightDashboard.vue', import.meta.url), 'utf8')
const topBarWeatherIconComputed = source.match(
  /const topBarWeatherIcon = computed[\s\S]*?\n}\)/
)?.[0] ?? ''

describe('smart light dashboard weather icon', () => {
  it('uses the mapped weather icon instead of the preview thunder icon', () => {
    assert.match(topBarWeatherIconComputed, /return map\[weatherIconType\.value\]/)
    assert.doesNotMatch(topBarWeatherIconComputed, /return 'thunder'/)
  })
})
