import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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

test('motion kernel never moves away after a rapid target reversal', async () => {
  const advanceFollower = extractMotionKernel(await readPrototype())
  const next = advanceFollower({ position: 100, velocity: 500 }, 50, 1 / 60)
  assert.ok(next.position <= 100)
  assert.ok(next.position >= 50)
})

test('desktop following starts only after Three.js is ready', async () => {
  const html = await readPrototype()
  assert.match(html, /let threeReady = false/)
  assert.match(html, /if \(!threeReady \|\| isStaticMode\(\) \|\| animationFrame\) return/)
  assert.match(html, /threeReady = true\s+experience\.classList\.add\('three-ready'\)/)
})

test('inline module has valid JavaScript syntax', async () => {
  const html = await readPrototype()
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/)
  assert.ok(match, 'inline module must exist')
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: match[1],
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
})
