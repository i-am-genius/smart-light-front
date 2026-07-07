import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync(new URL('../src/components/layout/TopStatusBar.vue', import.meta.url), 'utf8')

describe('top status bar structure', () => {
  it('keeps weather icon rules in script data instead of inline template checks', () => {
    assert.match(source, /const weatherIcons/)
    assert.match(source, /const weatherIcon = computed/)
    assert.doesNotMatch(source, /\['cloudy', 'rain', 'snow', 'thunder'\]\.includes/)
  })

  it('uses readable section comments for weather icon styling', () => {
    assert.match(source, /Weather icon layout/)
    assert.match(source, /Weather icon palette/)
    assert.doesNotMatch(source, /[�]/)
  })
})
