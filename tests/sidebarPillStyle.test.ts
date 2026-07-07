import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync(new URL('../src/components/layout/SidebarNav.vue', import.meta.url), 'utf8')

function getCssBlock(selector: string) {
  const start = source.indexOf(`${selector} {`)
  assert.notEqual(start, -1, `${selector} block should exist`)
  const bodyStart = source.indexOf('{', start) + 1
  const end = source.indexOf('\n}', bodyStart)
  assert.notEqual(end, -1, `${selector} block should close`)
  return source.slice(bodyStart, end)
}

describe('sidebar pill style', () => {
  it('does not tint the pill center with a full-surface glass filter', () => {
    const block = getCssBlock('.pill-indicator')

    assert.match(block, /background:\s*transparent;/)
    assert.match(block, /backdrop-filter:\s*none;/)
    assert.match(block, /-webkit-backdrop-filter:\s*none;/)
  })
})
