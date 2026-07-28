import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { compileStyle, parse } from '@vue/compiler-sfc'

const filename = 'StoreSettingsPanel.vue'
const source = readFileSync(
  new URL('../src/components/settings/StoreSettingsPanel.vue', import.meta.url),
  'utf8',
)
const { descriptor } = parse(source, { filename })
const template = descriptor.template?.content ?? ''
const style = descriptor.styles[0]?.content ?? ''
const compiledStyle = compileStyle({
  filename,
  id: 'data-v-theme-icon-test',
  scoped: true,
  source: style,
})

describe('store settings theme icon', () => {
  it('uses one SVG whose shared orb becomes a crescent', () => {
    const iconMarkup = template.match(
      /<span class="theme-mode-icon"[\s\S]*?<\/span>/,
    )?.[0] ?? ''

    assert.equal((iconMarkup.match(/<svg\b/g) ?? []).length, 1)
    assert.match(iconMarkup, /<mask\s+[\s\S]*?\bid="theme-crescent-mask"/)
    assert.match(iconMarkup, /class="theme-mask-cutout"/)
    assert.match(iconMarkup, /class="theme-orb"/)
    assert.match(
      iconMarkup,
      /class="theme-orb"[\s\S]*?mask="url\(#theme-crescent-mask\)"/,
    )
    assert.match(iconMarkup, /class="theme-star"/)
    assert.equal((iconMarkup.match(/class="theme-sun-ray"/g) ?? []).length, 8)
    assert.doesNotMatch(iconMarkup, /theme-mode-symbol|☀|☾/)
  })

  it('defines reversible night motion and a reduced-motion fallback', () => {
    assert.deepEqual(compiledStyle.errors, [])
    assert.match(style, /--theme-morph-duration:\s*420ms/)
    assert.match(style, /\.store-action-btn--theme\.is-night \.theme-mask-cutout/)
    assert.match(style, /\.store-action-btn--theme\.is-night \.theme-sun-rays/)
    assert.match(style, /\.store-action-btn--theme\.is-night \.theme-star/)
    assert.match(
      style,
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration:\s*0\.01ms !important;[\s\S]*?transition-delay:\s*0ms !important;/,
    )
  })

  it('keeps enough orb area visible for a visually balanced crescent', () => {
    const orbRadius = Number(template.match(/class="theme-orb"[\s\S]*?\br="([\d.]+)"/)?.[1])
    const cutoutMarkup = template.match(/class="theme-mask-cutout"[\s\S]*?\/>/)?.[0] ?? ''
    const cutoutX = Number(cutoutMarkup.match(/\bcx="([\d.]+)"/)?.[1])
    const cutoutY = Number(cutoutMarkup.match(/\bcy="([\d.]+)"/)?.[1])
    const cutoutRadius = Number(cutoutMarkup.match(/\br="([\d.]+)"/)?.[1])
    const centerDistance = Math.hypot(cutoutX - 12, cutoutY - 12)

    assert.ok(orbRadius - cutoutRadius >= 1)
    assert.ok(centerDistance > Math.abs(orbRadius - cutoutRadius))
    assert.ok(centerDistance < orbRadius + cutoutRadius)
  })
})
