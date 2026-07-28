import { reactive, readonly } from 'vue'

export const LOGIN_BEAM_ROUTE_SWAP_MS = 660
export const LOGIN_BEAM_TOTAL_MS = 1100

export interface AuthLightPose {
  lampX: number
  lampY: number
  lightX: number
  lightY: number
  lampAngle: number
  viewportWidth: number
  viewportHeight: number
}

export interface AuthLightSnapshot {
  lampXRatio: number
  lampYRatio: number
  lightXRatio: number
  lightYRatio: number
  lampAngle: number
}

export interface BeamPoint {
  x: number
  y: number
}

export type BeamTriangle = readonly [BeamPoint, BeamPoint, BeamPoint]

export interface ContinuousFanGeometry {
  start: BeamTriangle
  end: BeamTriangle
  axis: BeamPoint
  hinge: BeamPoint
  pivotBackward: number
  startForward: number
  startFarHalfWidth: number
  endForward: number
  endFarHalfWidth: number
}

export interface LoginBeamTransitionState {
  active: boolean
  runId: number
  mode: 'aperture' | 'fade'
  snapshot: AuthLightSnapshot
}

type Navigate = () => Promise<unknown> | unknown
type Wait = (ms: number, signal: AbortSignal) => Promise<void>

export const DEFAULT_AUTH_LIGHT_SNAPSHOT: AuthLightSnapshot = {
  lampXRatio: 0.5,
  lampYRatio: 0.1,
  lightXRatio: 0.5,
  lightYRatio: 0.54,
  lampAngle: 0,
}

const MAX_CONTINUOUS_FAN_SLOPE = 1.5

function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value))
}

function safeSnapshotRatio(value: number, fallback: number) {
  return Number.isFinite(value) ? clampRatio(value) : fallback
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function computeContinuousFanGeometry(
  snapshot: AuthLightSnapshot,
  viewportWidth: number,
  viewportHeight: number,
): ContinuousFanGeometry {
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1
  const lamp = {
    x: safeSnapshotRatio(snapshot.lampXRatio, DEFAULT_AUTH_LIGHT_SNAPSHOT.lampXRatio) * width,
    y: safeSnapshotRatio(snapshot.lampYRatio, DEFAULT_AUTH_LIGHT_SNAPSHOT.lampYRatio) * height,
  }
  const target = {
    x: safeSnapshotRatio(snapshot.lightXRatio, DEFAULT_AUTH_LIGHT_SNAPSHOT.lightXRatio) * width,
    y: safeSnapshotRatio(snapshot.lightYRatio, DEFAULT_AUTH_LIGHT_SNAPSHOT.lightYRatio) * height,
  }
  const deltaX = target.x - lamp.x
  const deltaY = target.y - lamp.y
  const distance = Math.hypot(deltaX, deltaY)
  const coincidentThreshold = Math.max(0.5, Math.hypot(width, height) * 1e-6)
  const axis = distance > coincidentThreshold
    ? { x: deltaX / distance, y: deltaY / distance }
    : { x: 0, y: 1 }
  const perpendicular = { x: axis.y, y: -axis.x }
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
  const projected = corners.map(corner => {
    const x = corner.x - lamp.x
    const y = corner.y - lamp.y
    return {
      longitudinal: x * axis.x + y * axis.y,
      perpendicular: x * perpendicular.x + y * perpendicular.y,
    }
  })
  const overscan = clamp(Math.min(width, height) * 0.025, 12, 24)
  const minimumLongitudinal = Math.min(...projected.map(point => point.longitudinal))
  const maximumLongitudinal = Math.max(...projected.map(point => point.longitudinal))
  const startForward = Math.max(80, distance + clamp(distance * 0.12, 36, 100))
  const startFarHalfWidthCap = Math.max(
    4,
    Math.min(180, Math.min(width, height) * 0.2),
  )
  const startFarHalfWidthFloor = Math.min(48, startFarHalfWidthCap)
  const startFarHalfWidth = clamp(
    distance * 0.22,
    startFarHalfWidthFloor,
    startFarHalfWidthCap,
  )
  const maximumPerpendicularWithMargin = Math.max(
    ...projected.map(point => Math.abs(point.perpendicular) + overscan),
  )
  const minimumCornerDepth = Math.max(
    overscan,
    maximumPerpendicularWithMargin / MAX_CONTINUOUS_FAN_SLOPE,
  )
  const minimumStartDepth =
    (startFarHalfWidth + overscan) / MAX_CONTINUOUS_FAN_SLOPE
  const pivotBackward = Math.max(
    24,
    -minimumLongitudinal + minimumCornerDepth,
    minimumStartDepth - startForward,
  )
  const endForward = Math.max(
    maximumLongitudinal + overscan,
    startForward + overscan,
  )
  const endDepthFromHinge = pivotBackward + endForward
  const startSlope = startFarHalfWidth / (pivotBackward + startForward)
  const requiredCoverageSlope = Math.max(
    ...projected.map(point =>
      (Math.abs(point.perpendicular) + overscan) /
      (point.longitudinal + pivotBackward),
    ),
  )
  const endSlope = Math.max(
    requiredCoverageSlope,
    startSlope + overscan / endDepthFromHinge,
  )
  const endFarHalfWidth = endSlope * endDepthFromHinge

  const fromLocal = (x: number, y: number): BeamPoint => ({
    x: lamp.x + perpendicular.x * x + axis.x * y,
    y: lamp.y + perpendicular.y * x + axis.y * y,
  })
  const hinge = fromLocal(0, -pivotBackward)
  const triangle = (
    forward: number,
    farHalfWidth: number,
  ): BeamTriangle => [
    hinge,
    fromLocal(farHalfWidth, forward),
    fromLocal(-farHalfWidth, forward),
  ]

  return {
    start: triangle(startForward, startFarHalfWidth),
    end: triangle(endForward, endFarHalfWidth),
    axis,
    hinge,
    pivotBackward,
    startForward,
    startFarHalfWidth,
    endForward,
    endFarHalfWidth,
  }
}

function finiteRatio(value: number, size: number, fallback: number) {
  if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) return fallback
  return clampRatio(value / size)
}

export function normalizeAuthLightSnapshot(
  pose: AuthLightPose | null | undefined,
): AuthLightSnapshot {
  if (!pose) return { ...DEFAULT_AUTH_LIGHT_SNAPSHOT }
  return {
    lampXRatio: finiteRatio(pose.lampX, pose.viewportWidth, 0.5),
    lampYRatio: finiteRatio(pose.lampY, pose.viewportHeight, 0.1),
    lightXRatio: finiteRatio(pose.lightX, pose.viewportWidth, 0.5),
    lightYRatio: finiteRatio(pose.lightY, pose.viewportHeight, 0.54),
    lampAngle: Number.isFinite(pose.lampAngle) ? pose.lampAngle : 0,
  }
}

function waitWithAbort(ms: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

function browserSupportsAperture() {
  if (typeof CSS === 'undefined') return false
  return CSS.supports('clip-path', 'polygon(0 0, 100% 0, 100% 100%)')
}

export function createLoginBeamTransitionController(options: {
  wait?: Wait
  supportsAperture?: () => boolean
} = {}) {
  const wait = options.wait ?? waitWithAbort
  const supportsAperture = options.supportsAperture ?? browserSupportsAperture
  const mutableState = reactive<LoginBeamTransitionState>({
    active: false,
    runId: 0,
    mode: 'aperture',
    snapshot: { ...DEFAULT_AUTH_LIGHT_SNAPSHOT },
  })
  let latestSnapshot = { ...DEFAULT_AUTH_LIGHT_SNAPSHOT }
  let activeRun: Promise<void> | null = null
  let activeAbort: AbortController | null = null

  function record(pose: AuthLightPose) {
    if (mutableState.active) return
    latestSnapshot = normalizeAuthLightSnapshot(pose)
  }

  function cancel() {
    if (!activeAbort) return
    mutableState.active = false
    activeAbort.abort()
  }

  function play(navigate: Navigate) {
    if (activeRun) return activeRun

    let mode: LoginBeamTransitionState['mode']
    try {
      mode = supportsAperture() ? 'aperture' : 'fade'
    } catch {
      let run: Promise<void>
      run = Promise.resolve()
        .then(navigate)
        .then(() => undefined)
        .finally(() => {
          if (activeRun === run) activeRun = null
        })
      activeRun = run
      return run
    }

    const abort = new AbortController()
    activeAbort = abort
    mutableState.active = true
    mutableState.runId += 1
    mutableState.mode = mode
    mutableState.snapshot = {
      ...latestSnapshot,
      lampXRatio: 0.5,
      lightXRatio: 0.5,
      lampAngle: 0,
    }

    let resolveExecution!: () => void
    let rejectExecution!: (reason: unknown) => void
    const execution = new Promise<void>((resolve, reject) => {
      resolveExecution = () => resolve()
      rejectExecution = (reason) => reject(reason)
    })
    let run: Promise<void>
    run = execution.finally(() => {
      abort.abort()
      mutableState.active = false
      if (activeAbort === abort) activeAbort = null
      if (activeRun === run) activeRun = null
    })
    activeRun = run

    void (async () => {
      if (abort.signal.aborted) return

      const completionFailed = Symbol('completion failed')
      let completionWait: Promise<void>
      let routeSwapWait: Promise<void>
      let completionFailure: Promise<typeof completionFailed>
      try {
        completionWait = wait(LOGIN_BEAM_TOTAL_MS, abort.signal)
        completionFailure = completionWait.then(
          () => new Promise<never>(() => undefined),
          () => completionFailed,
        )
        routeSwapWait = wait(LOGIN_BEAM_ROUTE_SWAP_MS, abort.signal)
      } catch {
        if (!abort.signal.aborted) await navigate()
        return
      }

      let presentationFailed = false
      try {
        const firstTimer = await Promise.race([routeSwapWait, completionFailure])
        presentationFailed = firstTimer === completionFailed
      } catch {
        presentationFailed = true
      }

      if (abort.signal.aborted) return
      await navigate()
      if (!presentationFailed) await completionWait.catch(() => undefined)
    })().then(resolveExecution, rejectExecution)

    return run
  }

  return {
    state: readonly(mutableState),
    record,
    play,
    cancel,
  }
}

const controller = createLoginBeamTransitionController()

export const loginBeamTransitionState = controller.state
export const recordAuthLightSnapshot = controller.record
export const playLoginBeamTransition = controller.play
export const cancelLoginBeamTransition = controller.cancel
