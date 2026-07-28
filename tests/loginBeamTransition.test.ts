import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_AUTH_LIGHT_SNAPSHOT,
  LOGIN_BEAM_ROUTE_SWAP_MS,
  LOGIN_BEAM_TOTAL_MS,
  computeContinuousFanGeometry,
  createLoginBeamTransitionController,
  normalizeAuthLightSnapshot,
  type BeamPoint,
  type BeamTriangle,
} from '../src/components/auth/loginBeamTransition.ts'

function polygonSignedArea(polygon: BeamTriangle) {
  let signedArea = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    signedArea += start.x * end.y - start.y * end.x
  }
  return signedArea / 2
}

function pointInsideConvexPolygon(point: BeamPoint, polygon: BeamTriangle) {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    polygon.some(vertex => !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y))
  ) {
    return false
  }

  const signedArea = polygonSignedArea(polygon)
  if (!Number.isFinite(signedArea) || Math.abs(signedArea) < 1e-7) return false

  const orientation = Math.sign(signedArea)
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const cross =
      (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x)
    if (!Number.isFinite(cross) || cross * orientation <= 1e-7) return false
  }
  return true
}

function viewportCorners(width: number, height: number): BeamPoint[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

test('convex containment rejects collapsed, non-finite, and edge-only triangles', () => {
  assert.equal(
    pointInsideConvexPolygon(
      { x: 0, y: 0 },
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
    ),
    false,
  )
  assert.equal(
    pointInsideConvexPolygon(
      { x: 0, y: 0 },
      [{ x: Number.NaN, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    ),
    false,
  )
  assert.equal(
    pointInsideConvexPolygon(
      { x: 0, y: 0 },
      [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    ),
    false,
  )
})

function createWaitHarness() {
  const pending: Array<{
    ms: number
    aborted: boolean
    resolve: () => void
  }> = []

  return {
    pending,
    wait(ms: number, signal: AbortSignal) {
      return new Promise<void>((resolve) => {
        const item = { ms, aborted: false, resolve }
        pending.push(item)
        signal.addEventListener(
          'abort',
          () => {
            item.aborted = true
            resolve()
          },
          { once: true },
        )
      })
    },
    resolve(ms: number) {
      const item = pending.find(candidate => candidate.ms === ms && !candidate.aborted)
      assert.ok(item, `Missing pending wait for ${ms}ms`)
      item.resolve()
    },
  }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

test('swaps the route after full coverage at 660ms and completes at 1100ms', () => {
  assert.equal(LOGIN_BEAM_ROUTE_SWAP_MS, 660)
  assert.equal(LOGIN_BEAM_TOTAL_MS, 1100)
})

test('normalizes and clamps a live auth light pose', () => {
  assert.deepEqual(
    normalizeAuthLightSnapshot({
      lampX: 1200,
      lampY: 90,
      lightX: -100,
      lightY: 450,
      lampAngle: 0.08,
      viewportWidth: 1000,
      viewportHeight: 900,
    }),
    {
      lampXRatio: 1,
      lampYRatio: 0.1,
      lightXRatio: 0,
      lightYRatio: 0.5,
      lampAngle: 0.08,
    },
  )
  assert.deepEqual(normalizeAuthLightSnapshot(null), DEFAULT_AUTH_LIGHT_SNAPSHOT)
})

test('continuous fan uses one shared hinge and covers every viewport corner', () => {
  for (const { snapshot, width, height } of [
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 1440, height: 900 },
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 390, height: 844 },
    {
      snapshot: {
        lampXRatio: 0.22,
        lampYRatio: 0.08,
        lightXRatio: 0.88,
        lightYRatio: 0.72,
        lampAngle: 0.12,
      },
      width: 1440,
      height: 900,
    },
    {
      snapshot: {
        lampXRatio: 0,
        lampYRatio: 0.1,
        lightXRatio: 1,
        lightYRatio: 0.7,
        lampAngle: 0.12,
      },
      width: 1440,
      height: 900,
    },
    {
      snapshot: {
        lampXRatio: 1,
        lampYRatio: 0.1,
        lightXRatio: 0,
        lightYRatio: 0.7,
        lampAngle: -0.12,
      },
      width: 1440,
      height: 900,
    },
  ]) {
    const geometry = computeContinuousFanGeometry(snapshot, width, height)
    assert.deepEqual(geometry.start[0], geometry.end[0])
    assert.deepEqual(geometry.start[0], geometry.hinge)
    assert.equal(geometry.start.length, 3)
    assert.equal(geometry.end.length, 3)
    const perpendicular = { x: geometry.axis.y, y: -geometry.axis.x }
    for (const triangle of [geometry.start, geometry.end]) {
      assert.ok(polygonSignedArea(triangle) > 1e-7)
      const right = {
        x: triangle[1].x - geometry.hinge.x,
        y: triangle[1].y - geometry.hinge.y,
      }
      const left = {
        x: triangle[2].x - geometry.hinge.x,
        y: triangle[2].y - geometry.hinge.y,
      }
      assert.ok(right.x * perpendicular.x + right.y * perpendicular.y > 0)
      assert.ok(left.x * perpendicular.x + left.y * perpendicular.y < 0)
    }
    for (const corner of viewportCorners(width, height)) {
      assert.ok(pointInsideConvexPolygon(corner, geometry.end))
    }
  }
})

test('continuous fan strictly widens and lengthens around its fixed hinge', () => {
  for (const { snapshot, width, height } of [
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 1440, height: 900 },
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 390, height: 844 },
    {
      snapshot: {
        lampXRatio: 0.22,
        lampYRatio: 0.08,
        lightXRatio: 0.88,
        lightYRatio: 0.72,
        lampAngle: 0.12,
      },
      width: 1440,
      height: 900,
    },
  ]) {
    const geometry = computeContinuousFanGeometry(snapshot, width, height)
    assert.ok(geometry.pivotBackward > 0)
    assert.ok(geometry.endForward > geometry.startForward)
    assert.ok(geometry.endFarHalfWidth > geometry.startFarHalfWidth)
    assert.ok(
      geometry.endFarHalfWidth / (geometry.pivotBackward + geometry.endForward) >
      geometry.startFarHalfWidth / (geometry.pivotBackward + geometry.startForward),
    )
    assert.deepEqual(geometry.start[0], geometry.hinge)
    assert.deepEqual(geometry.end[0], geometry.hinge)
  }
})

test('continuous fan keeps its final angle and coordinates within stable bounds', () => {
  for (const { snapshot, width, height } of [
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 1440, height: 900 },
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 390, height: 844 },
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 7680, height: 4320 },
    {
      snapshot: {
        lampXRatio: 0.22,
        lampYRatio: 0.08,
        lightXRatio: 0.88,
        lightYRatio: 0.72,
        lampAngle: 0.12,
      },
      width: 1440,
      height: 900,
    },
  ]) {
    const geometry = computeContinuousFanGeometry(snapshot, width, height)
    assert.ok(geometry.startFarHalfWidth <= 180)
    const endSlope =
      geometry.endFarHalfWidth / (geometry.pivotBackward + geometry.endForward)
    assert.ok(endSlope <= 1.5 + 1e-9, `expected slope <= 1.5, received ${endSlope}`)

    const coordinateBound = Math.hypot(width, height) * 4
    for (const point of geometry.end) {
      assert.ok(Math.abs(point.x) <= coordinateBound)
      assert.ok(Math.abs(point.y) <= coordinateBound)
    }
  }
})

test('continuous fan keeps finite downward geometry for degenerate inputs', () => {
  const cases = [
    {
      snapshot: {
        lampXRatio: Number.NaN,
        lampYRatio: Number.POSITIVE_INFINITY,
        lightXRatio: Number.NEGATIVE_INFINITY,
        lightYRatio: Number.NaN,
        lampAngle: Number.NaN,
      },
      width: 390,
      height: 844,
    },
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 1, height: 1 },
    {
      snapshot: {
        lampXRatio: 0.5,
        lampYRatio: 0.5,
        lightXRatio: 0.5,
        lightYRatio: 0.5,
        lampAngle: 0,
      },
      width: 390,
      height: 844,
    },
  ]

  for (const { snapshot, width, height } of cases) {
    const geometry = computeContinuousFanGeometry(snapshot, width, height)
    assert.deepEqual(geometry.axis, { x: 0, y: 1 })
    assert.ok(geometry.endForward > geometry.startForward)
    assert.ok(geometry.endFarHalfWidth > geometry.startFarHalfWidth)
    assert.ok(
      geometry.endFarHalfWidth / (geometry.pivotBackward + geometry.endForward) >
      geometry.startFarHalfWidth / (geometry.pivotBackward + geometry.startForward),
    )
    for (const point of [...geometry.start, ...geometry.end]) {
      assert.ok(Number.isFinite(point.x))
      assert.ok(Number.isFinite(point.y))
    }
    for (const dimension of [
      geometry.pivotBackward,
      geometry.startForward,
      geometry.startFarHalfWidth,
      geometry.endForward,
      geometry.endFarHalfWidth,
    ]) {
      assert.ok(Number.isFinite(dimension))
    }
    for (const corner of viewportCorners(width, height)) {
      assert.ok(pointInsideConvexPolygon(corner, geometry.end))
    }
  }
})

test('continuous fan normalizes non-finite viewport dimensions', () => {
  const geometry = computeContinuousFanGeometry(
    DEFAULT_AUTH_LIGHT_SNAPSHOT,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  )
  for (const point of [...geometry.start, ...geometry.end]) {
    assert.ok(Number.isFinite(point.x))
    assert.ok(Number.isFinite(point.y))
  }
  for (const corner of viewportCorners(1, 1)) {
    assert.ok(pointInsideConvexPolygon(corner, geometry.end))
  }
})

test('centers the recorded transition snapshot and freezes it while active', async () => {
  const harness = createWaitHarness()
  const controller = createLoginBeamTransitionController({
    wait: harness.wait,
    supportsAperture: () => true,
  })
  const pose = {
    lampX: 1200,
    lampY: 90,
    lightX: -100,
    lightY: 450,
    lampAngle: 0.08,
    viewportWidth: 1000,
    viewportHeight: 900,
  }

  controller.record(pose)
  pose.lampX = 0
  pose.lampAngle = 1
  const run = controller.play(() => undefined)

  assert.deepEqual(controller.state.snapshot, {
    lampXRatio: 0.5,
    lampYRatio: 0.1,
    lightXRatio: 0.5,
    lightYRatio: 0.5,
    lampAngle: 0,
  })
  assert.deepEqual(
    computeContinuousFanGeometry(controller.state.snapshot, 1000, 900).axis,
    { x: 0, y: 1 },
  )

  controller.record({
    lampX: 0,
    lampY: 0,
    lightX: 1000,
    lightY: 900,
    lampAngle: 1,
    viewportWidth: 1000,
    viewportHeight: 900,
  })
  assert.deepEqual(controller.state.snapshot, {
    lampXRatio: 0.5,
    lampYRatio: 0.1,
    lightXRatio: 0.5,
    lightYRatio: 0.5,
    lampAngle: 0,
  })

  harness.resolve(LOGIN_BEAM_ROUTE_SWAP_MS)
  await flushPromises()
  harness.resolve(LOGIN_BEAM_TOTAL_MS)
  await run
})

test('swaps the route at 660ms and completes at 1100ms', async () => {
  const harness = createWaitHarness()
  const controller = createLoginBeamTransitionController({
    wait: harness.wait,
    supportsAperture: () => true,
  })
  let navigations = 0

  const first = controller.play(async () => {
    navigations += 1
  })
  const second = controller.play(async () => {
    navigations += 1
  })

  assert.strictEqual(second, first)
  assert.equal(controller.state.active, true)
  assert.equal(controller.state.mode, 'aperture')
  assert.deepEqual(
    harness.pending.map(item => item.ms).sort((a, b) => a - b),
    [LOGIN_BEAM_ROUTE_SWAP_MS, LOGIN_BEAM_TOTAL_MS],
  )

  harness.resolve(LOGIN_BEAM_ROUTE_SWAP_MS)
  await flushPromises()
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, true)

  harness.resolve(LOGIN_BEAM_TOTAL_MS)
  await first
  assert.equal(controller.state.active, false)
})

test('uses the opacity fallback when aperture CSS is unavailable', async () => {
  const harness = createWaitHarness()
  const controller = createLoginBeamTransitionController({
    wait: harness.wait,
    supportsAperture: () => false,
  })
  let navigations = 0
  const run = controller.play(() => {
    navigations += 1
  })

  assert.equal(controller.state.mode, 'fade')
  harness.resolve(LOGIN_BEAM_ROUTE_SWAP_MS)
  await flushPromises()
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, true)
  harness.resolve(LOGIN_BEAM_TOTAL_MS)
  await run
  assert.equal(controller.state.active, false)
})

test('uses aperture mode when polygon clip-path is supported', async () => {
  const originalCss = Object.getOwnPropertyDescriptor(globalThis, 'CSS')
  const harness = createWaitHarness()
  const controller = createLoginBeamTransitionController({ wait: harness.wait })
  let run: Promise<void> | undefined

  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: { supports: () => true },
    writable: true,
  })

  try {
    run = controller.play(() => undefined)
    assert.equal(controller.state.mode, 'aperture')

    harness.resolve(LOGIN_BEAM_ROUTE_SWAP_MS)
    await flushPromises()
    harness.resolve(LOGIN_BEAM_TOTAL_MS)
    await run
  } finally {
    controller.cancel()
    await run?.catch(() => undefined)
    if (originalCss) {
      Object.defineProperty(globalThis, 'CSS', originalCss)
    } else {
      Reflect.deleteProperty(globalThis, 'CSS')
    }
  }
})

test('navigates immediately when presentation setup throws', async () => {
  let navigations = 0
  const controller = createLoginBeamTransitionController({
    supportsAperture: () => {
      throw new Error('CSS unavailable')
    },
  })

  await controller.play(() => {
    navigations += 1
  })

  assert.equal(navigations, 1)
  assert.equal(controller.state.active, false)
})

test('deduplicates concurrent navigation when presentation setup throws', async () => {
  let navigations = 0
  let releaseNavigation!: () => void
  const navigationGate = new Promise<void>((resolve) => {
    releaseNavigation = resolve
  })
  const controller = createLoginBeamTransitionController({
    supportsAperture: () => {
      throw new Error('CSS unavailable')
    },
  })

  const first = controller.play(() => {
    navigations += 1
    return navigationGate
  })
  const second = controller.play(() => {
    navigations += 1
    return navigationGate
  })
  await Promise.resolve()
  const sharedRun = second === first
  const navigationCountBeforeRelease = navigations

  releaseNavigation()
  await Promise.all([first, second])

  assert.equal(sharedRun, true)
  assert.equal(navigationCountBeforeRelease, 1)
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, false)
})

test('deduplicates reentrant navigation when presentation setup throws', async () => {
  let navigations = 0
  let reentrantRun: Promise<void> | undefined
  const controller = createLoginBeamTransitionController({
    supportsAperture: () => {
      throw new Error('CSS unavailable')
    },
  })

  const run = controller.play(() => {
    navigations += 1
    reentrantRun = controller.play(() => {
      navigations += 1
    })
  })
  await run

  assert.strictEqual(reentrantRun, run)
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, false)
})

test('returns immediate navigation throws as a reusable rejected run', async () => {
  const controller = createLoginBeamTransitionController({
    supportsAperture: () => {
      throw new Error('CSS unavailable')
    },
  })
  let run: Promise<void> | undefined
  let synchronousError: unknown

  try {
    run = controller.play(() => {
      throw new Error('navigation failed synchronously')
    })
  } catch (error) {
    synchronousError = error
  }

  assert.equal(synchronousError, undefined)
  assert.ok(run)
  await assert.rejects(run, /navigation failed synchronously/)
  assert.equal(controller.state.active, false)

  let navigations = 0
  await controller.play(() => {
    navigations += 1
  })
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, false)
})

test('navigates immediately and remains reusable when wait setup throws', async () => {
  let navigations = 0
  const controller = createLoginBeamTransitionController({
    wait: () => {
      throw new Error('timer unavailable')
    },
    supportsAperture: () => true,
  })

  const first = controller.play(() => {
    navigations += 1
  })

  await first
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, false)

  const second = controller.play(() => {
    navigations += 1
  })

  assert.notStrictEqual(second, first)
  await second
  assert.equal(navigations, 2)
  assert.equal(controller.state.active, false)
})

test('remains reusable when wait setup and immediate navigation both throw', async () => {
  let navigations = 0
  const controller = createLoginBeamTransitionController({
    wait: () => {
      throw new Error('timer unavailable')
    },
    supportsAperture: () => true,
  })
  const navigate = () => {
    navigations += 1
    throw new Error('navigation failed synchronously')
  }

  const first = controller.play(navigate)
  await assert.rejects(first, /navigation failed synchronously/)
  assert.equal(controller.state.active, false)

  const second = controller.play(navigate)
  assert.notStrictEqual(second, first)
  await assert.rejects(second, /navigation failed synchronously/)
  assert.equal(navigations, 2)
  assert.equal(controller.state.active, false)
})

test('navigates immediately and remains reusable when route timing rejects', async () => {
  let navigations = 0
  const controller = createLoginBeamTransitionController({
    wait: (ms, signal) => {
      if (ms === LOGIN_BEAM_ROUTE_SWAP_MS) {
        return Promise.resolve().then(() => {
          throw new Error('route timer failed')
        })
      }

      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    },
    supportsAperture: () => true,
  })

  const first = controller.play(() => {
    navigations += 1
  })

  await first
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, false)

  const second = controller.play(() => {
    navigations += 1
  })

  assert.notStrictEqual(second, first)
  await second
  assert.equal(navigations, 2)
  assert.equal(controller.state.active, false)
})

test('navigates once and resolves when completion timing rejects before route timing', async () => {
  let rejectCompletion!: (reason: unknown) => void
  const unhandledRejections: unknown[] = []
  const onUnhandledRejection = (reason: unknown) => {
    unhandledRejections.push(reason)
  }
  const controller = createLoginBeamTransitionController({
    wait: (ms, signal) => {
      if (ms === LOGIN_BEAM_TOTAL_MS) {
        return new Promise<void>((_resolve, reject) => {
          rejectCompletion = reject
        })
      }

      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    },
    supportsAperture: () => true,
  })
  let navigations = 0
  let outcome: 'pending' | 'resolved' | 'rejected' = 'pending'
  process.on('unhandledRejection', onUnhandledRejection)

  const run = controller.play(() => {
    navigations += 1
  })
  void run.then(
    () => {
      outcome = 'resolved'
    },
    () => {
      outcome = 'rejected'
    },
  )
  rejectCompletion(new Error('completion timer failed'))
  await new Promise<void>((resolve) => setImmediate(resolve))

  const outcomeAfterFailure = outcome
  const activeAfterFailure = controller.state.active
  if (outcomeAfterFailure === 'pending') {
    controller.cancel()
    await run
  }
  await new Promise<void>((resolve) => setImmediate(resolve))
  process.off('unhandledRejection', onUnhandledRejection)

  assert.equal(outcomeAfterFailure, 'resolved')
  assert.equal(navigations, 1)
  assert.equal(activeAfterFailure, false)
  assert.deepEqual(unhandledRejections, [])
})

test('clears active state and propagates navigation rejection', async () => {
  const harness = createWaitHarness()
  const controller = createLoginBeamTransitionController({
    wait: harness.wait,
    supportsAperture: () => true,
  })
  let navigations = 0
  const run = controller.play(() => {
    navigations += 1
    return Promise.reject(new Error('navigation failed'))
  })

  harness.resolve(LOGIN_BEAM_ROUTE_SWAP_MS)
  await assert.rejects(run, /navigation failed/)
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, false)
  assert.ok(harness.pending.find(item => item.ms === LOGIN_BEAM_TOTAL_MS)?.aborted)
})

test('cancellation clears waits without navigating', async () => {
  const harness = createWaitHarness()
  const controller = createLoginBeamTransitionController({
    wait: harness.wait,
    supportsAperture: () => true,
  })
  let navigations = 0
  const run = controller.play(() => {
    navigations += 1
  })

  controller.cancel()
  await run

  assert.equal(navigations, 0)
  assert.equal(controller.state.active, false)
  assert.ok(harness.pending.every(item => item.aborted))
})

test('cancellation hides the transition while in-flight navigation remains deduplicated', async () => {
  const harness = createWaitHarness()
  const controller = createLoginBeamTransitionController({
    wait: harness.wait,
    supportsAperture: () => true,
  })
  let navigations = 0
  let releaseNavigation!: () => void
  const navigationGate = new Promise<void>((resolve) => {
    releaseNavigation = resolve
  })
  const run = controller.play(() => {
    navigations += 1
    return navigationGate
  })
  let settled = false
  void run.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )

  harness.resolve(LOGIN_BEAM_ROUTE_SWAP_MS)
  await flushPromises()
  assert.equal(navigations, 1)

  controller.cancel()
  const activeAfterCancel = controller.state.active
  const duplicate = controller.play(() => {
    navigations += 1
  })
  await flushPromises()
  const settledWhileNavigationPending = settled

  releaseNavigation()
  await Promise.all([run, duplicate])

  assert.equal(activeAfterCancel, false)
  assert.strictEqual(duplicate, run)
  assert.equal(settledWhileNavigationPending, false)
  assert.equal(navigations, 1)
  assert.equal(controller.state.active, false)
})
