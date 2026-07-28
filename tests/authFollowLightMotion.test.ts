import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceFollower,
  clampTrackTarget,
  isStaticLightMode,
  resolveDefaultLampX,
} from '../src/components/auth/authFollowLightMotion.ts'

test('far targets accelerate faster than near targets', () => {
  const near = advanceFollower({ position: 0, velocity: 0 }, 20, 1 / 60)
  const far = advanceFollower({ position: 0, velocity: 0 }, 200, 1 / 60)
  assert.ok(far.position > near.position)
})

test('follower brakes without overshooting the target', () => {
  const next = advanceFollower({ position: 98, velocity: 80 }, 100, 1 / 30)
  assert.ok(next.position >= 98)
  assert.ok(next.position <= 100)
})

test('follower never moves away after a rapid target reversal', () => {
  const next = advanceFollower({ position: 100, velocity: 500 }, 50, 1 / 60)
  assert.ok(next.position >= 50)
  assert.ok(next.position <= 100)
})

test('follower covers most of a long move within 550ms', () => {
  let state = { position: 0, velocity: 0 }
  for (let frame = 0; frame < 33; frame += 1) {
    state = advanceFollower(state, 500, 1 / 60)
  }
  assert.ok(state.position >= 400, `expected at least 400px, received ${state.position}`)
})

test('desktop track remains inside the approved horizontal range', () => {
  assert.equal(clampTrackTarget(0, 1000), 220)
  assert.equal(clampTrackTarget(1000, 1000), 780)
  assert.equal(clampTrackTarget(540, 1000), 540)
})

test('mobile and reduced-motion viewports use static lighting', () => {
  assert.equal(isStaticLightMode(760, false), true)
  assert.equal(isStaticLightMode(761, false), false)
  assert.equal(isStaticLightMode(1440, true), true)
})

test('mobile static lamp centers over the form for a vertical beam', () => {
  assert.equal(resolveDefaultLampX(195, 374, 390), 195)
  assert.equal(resolveDefaultLampX(720, 1080, 1440), 720)
})
