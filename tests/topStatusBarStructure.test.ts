import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { compileStyle, parse } from '@vue/compiler-sfc'

const source = readFileSync(new URL('../src/components/layout/TopStatusBar.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source, { filename: 'TopStatusBar.vue' })
const compiledStyle = compileStyle({
  filename: 'TopStatusBar.vue',
  id: 'data-v-top-status-bar-test',
  scoped: true,
  source: descriptor.styles[0]?.content ?? '',
})

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
  it('keeps night mode declarations scoped to top status bar descendants', () => {
    const expectedSelectors = [
      '.app-container.night-mode .current-time',
      '.app-container.night-mode .time-row',
      '.app-container.night-mode .weather-icon',
      '.app-container.night-mode .icon-snow .snowflake path',
      '.app-container.night-mode .weather-icon--snow .cloud-fill',
      '.app-container.night-mode .time-divider',
    ]

    assert.deepEqual(compiledStyle.errors, [])
    for (const selector of expectedSelectors) {
      const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      assert.match(compiledStyle.code, new RegExp(`${escapedSelector}\\s*\\{`))
    }
    assert.doesNotMatch(compiledStyle.code, /\.app-container\.night-mode\s*\{/)
  })
})
