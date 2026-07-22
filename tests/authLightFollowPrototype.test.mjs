import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const prototypeUrl = new URL('../docs/prototypes/auth-light-follow.html', import.meta.url)

async function readPrototype() {
  return readFile(prototypeUrl, 'utf8')
}

function extractMotionKernel(html) {
  const match = html.match(/\/\* MOTION_KERNEL_START \*\/([\s\S]*?)\/\* MOTION_KERNEL_END \*\//)
  assert.ok(match, 'motion kernel markers must exist')
  return vm.runInNewContext(`(() => {${match[1]}; return advanceFollower})()`)
}

test('prototype keeps the required interaction and readability contracts', async () => {
  const html = await readPrototype()
  assert.match(html, /data-follow-mode="desktop-pointer"/)
  assert.match(html, /--peripheral-dim:\s*\.16/)
  assert.match(html, /@media \(max-width: 760px\)/)
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(html, /pointerdown|pointerup|gravity|beamStartAngle|angleRange/)
})

test('far targets accelerate faster than near targets', async () => {
  const advanceFollower = extractMotionKernel(await readPrototype())
  const near = advanceFollower({ position: 0, velocity: 0 }, 20, 1 / 60)
  const far = advanceFollower({ position: 0, velocity: 0 }, 200, 1 / 60)
  assert.ok(far.position > near.position)
})

test('motion kernel brakes without overshooting the target', async () => {
  const advanceFollower = extractMotionKernel(await readPrototype())
  const next = advanceFollower({ position: 98, velocity: 80 }, 100, 1 / 30)
  assert.ok(next.position <= 100)
  assert.ok(next.position >= 98)
})

test('inline module has valid JavaScript syntax', async () => {
  const html = await readPrototype()
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/)
  assert.ok(match, 'inline module must exist')
  assert.doesNotThrow(() => new vm.SourceTextModule(match[1]))
})
