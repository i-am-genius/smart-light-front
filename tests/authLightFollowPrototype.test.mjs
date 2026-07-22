import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const prototypeUrl = new URL('../docs/prototypes/auth-light-follow.html', import.meta.url)

async function readPrototype() {
  return readFile(prototypeUrl, 'utf8')
}

function extractMotionKernel(html, functionName = 'advanceFollower') {
  const match = html.match(/\/\* MOTION_KERNEL_START \*\/([\s\S]*?)\/\* MOTION_KERNEL_END \*\//)
  assert.ok(match, 'motion kernel markers must exist')
  assert.match(match[1], new RegExp(`function\\s+${functionName}\\s*\\(`))
  return vm.runInNewContext(`(() => {${match[1]}; return ${functionName}})()`)
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

test('lamp center axis lands exactly on the pointer target', async () => {
  const calculateAimAngle = extractMotionKernel(await readPrototype(), 'calculateAimAngle')
  const lamp = { x: 320, y: 180 }
  const pointer = { x: 680, y: 540 }
  const distance = Math.hypot(pointer.x - lamp.x, pointer.y - lamp.y)
  const angle = calculateAimAngle(lamp.x, lamp.y, pointer.x, pointer.y)

  assert.ok(Math.abs(angle - Math.PI / 4) < 1e-10)
  assert.ok(Math.abs(lamp.x + Math.sin(angle) * distance - pointer.x) < 1e-8)
  assert.ok(Math.abs(lamp.y + Math.cos(angle) * distance - pointer.y) < 1e-8)
})

test('lamp horizontal travel stays within the narrower center track', async () => {
  const clampTrackTarget = extractMotionKernel(await readPrototype(), 'clampTrackTarget')
  assert.equal(clampTrackTarget(0, 1000), 270)
  assert.equal(clampTrackTarget(1000, 1000), 730)
  assert.equal(clampTrackTarget(540, 1000), 540)
})

test('lamp eases across the track at the reduced speed', async () => {
  const advanceFollower = extractMotionKernel(await readPrototype())
  let state = { position: 0, velocity: 0 }
  for (let frame = 0; frame < 24; frame += 1) {
    state = advanceFollower(state, 500, 1 / 60)
  }
  assert.ok(state.position >= 300, `expected at least 300px, received ${state.position}`)
  assert.ok(state.position <= 350, `expected at most 350px, received ${state.position}`)
})

test('motion kernel covers most of a long move within 550ms', async () => {
  const advanceFollower = extractMotionKernel(await readPrototype())
  let state = { position: 0, velocity: 0 }
  for (let frame = 0; frame < 33; frame += 1) {
    state = advanceFollower(state, 500, 1 / 60)
  }
  assert.ok(state.position >= 400, `expected at least 400px, received ${state.position}`)
})

test('prototype uses a stronger readable light without a moving power line', async () => {
  const html = await readPrototype()
  assert.match(html, /--moving-light-opacity:\s*\.72/)
  assert.match(html, /--moving-light-core:\s*\.46/)
  assert.doesNotMatch(html, /const rail|const ceilingCap|const cable/)
  assert.match(html, /\.fallback-lamp\s*\{[^}]*background:\s*transparent/s)
})

test('desktop lamp pose and visible light use the same pointer target', async () => {
  const html = await readPrototype()
  assert.doesNotMatch(html, /const lightState/)
  assert.match(html, /headAngle = calculateAimAngle\(lampState\.position, lampAnchorScreenY, pointerTarget\.x, pointerTarget\.y\)/)
  assert.match(html, /applyLighting\(pointerTarget\.x, pointerTarget\.y\)/)
  assert.match(html, /const localX = screenX - rect\.left/)
  assert.match(html, /const localY = screenY - rect\.top/)
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
