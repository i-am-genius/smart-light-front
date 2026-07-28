# Login Single-Beam Fullscreen Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing login spotlight itself grow wider and longer until its own boundary overshoots and covers the full viewport, without an auxiliary wash or screen-corner morph.

**Architecture:** Add a pure beam-local geometry function to the existing transition controller module. It projects the viewport corners onto the frozen lamp-to-light basis and returns narrow start and viewport-covering end polygons. `LoginBeamTransition.vue` binds those points to CSS variables and animates the existing `.beam-aperture`; all other opening-light layers are removed.

**Tech Stack:** Vue 3, TypeScript, CSS polygon `clip-path`, Node test runner, Playwright/Edge visual QA.

## Global Constraints

- Opening illumination is rendered by exactly one existing `.beam-aperture` element.
- The lamp-to-light beam axis stays frozen for the whole transition.
- Beam length, near width, far width, and brightness increase monotonically.
- Full viewport coverage is reached at `616ms` (`56%` of `1100ms`) and held through the existing `660ms` route timing.
- `.beam-wash`, `.beam-hotspot`, radial masks, screen-corner morphing, and full-screen opacity substitutes are forbidden.
- Dashboard reveal behavior is not redesigned in this plan.
- Do not change authentication, persistence, route guards, layout, backgrounds, lamp geometry, follow-light physics, or Dashboard code.
- Preserve unrelated dirty-worktree changes. Do not stage or commit files.

---

## File Map

- `src/components/auth/loginBeamTransition.ts`: owns snapshot normalization, transition timing, and the new pure single-beam polygon calculation.
- `src/components/auth/LoginBeamTransition.vue`: renders and animates the one existing beam from calculated start points to calculated end points.
- `tests/loginBeamTransition.test.ts`: proves geometry coverage, fallback direction, overscan, and unchanged controller behavior.
- `tests/loginBeamTransitionIntegration.test.ts`: proves the DOM/CSS uses one beam and contains no substitute lighting layer.
- `output/playwright/login-beam-transition/capture-exact-keyframes.mjs`: captures deterministic paused keyframes and reports the beam polygon.
- `output/playwright/login-beam-transition/verify-transition.mjs`: verifies the real login flow and resulting single-beam state.

### Task 1: Pure Single-Beam Geometry

**Files:**
- Modify: `src/components/auth/loginBeamTransition.ts`
- Test: `tests/loginBeamTransition.test.ts`

**Interfaces:**
- Consumes: `AuthLightSnapshot`, viewport width, viewport height.
- Produces: `computeSingleBeamGeometry(snapshot, viewportWidth, viewportHeight): SingleBeamGeometry`.
- Produces types: `BeamPoint`, `BeamPolygon`, and `SingleBeamGeometry`.

- [ ] **Step 1: Add geometry-focused failing tests**

Add a convex-polygon assertion helper and representative cases:

```ts
import {
  computeSingleBeamGeometry,
  type BeamPoint,
  type BeamPolygon,
} from '../src/components/auth/loginBeamTransition.ts'

function pointInsideConvexPolygon(point: BeamPoint, polygon: BeamPolygon) {
  let sign = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const cross =
      (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x)
    if (Math.abs(cross) < 1e-7) continue
    const nextSign = Math.sign(cross)
    if (sign && nextSign !== sign) return false
    sign = nextSign
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

test('single-beam geometry covers every viewport corner on desktop and mobile', () => {
  const cases = [
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 1440, height: 900 },
    { snapshot: DEFAULT_AUTH_LIGHT_SNAPSHOT, width: 390, height: 844 },
    {
      snapshot: {
        lampXRatio: 0,
        lampYRatio: 1,
        lightXRatio: 1,
        lightYRatio: 0,
        lampAngle: 0,
      },
      width: 390,
      height: 844,
    },
  ]

  for (const { snapshot, width, height } of cases) {
    const geometry = computeSingleBeamGeometry(snapshot, width, height)
    for (const corner of viewportCorners(width, height)) {
      assert.ok(pointInsideConvexPolygon(corner, geometry.end))
    }
  }
})

test('single-beam geometry keeps its axis and expands both length and width', () => {
  const snapshot = {
    lampXRatio: 0.35,
    lampYRatio: 0.08,
    lightXRatio: 0.62,
    lightYRatio: 0.58,
    lampAngle: 0.12,
  }
  const geometry = computeSingleBeamGeometry(snapshot, 1440, 900)

  assert.ok(geometry.endForward > geometry.startForward)
  assert.ok(geometry.endBackward > geometry.startBackward)
  assert.ok(geometry.endNearHalfWidth > geometry.startNearHalfWidth)
  assert.ok(geometry.endFarHalfWidth > geometry.startFarHalfWidth)

  const nearMidpoint = {
    x: (geometry.start[0].x + geometry.start[1].x) / 2,
    y: (geometry.start[0].y + geometry.start[1].y) / 2,
  }
  const farMidpoint = {
    x: (geometry.start[2].x + geometry.start[3].x) / 2,
    y: (geometry.start[2].y + geometry.start[3].y) / 2,
  }
  const centerline = {
    x: farMidpoint.x - nearMidpoint.x,
    y: farMidpoint.y - nearMidpoint.y,
  }
  assert.ok(Math.abs(centerline.x * geometry.axis.y - centerline.y * geometry.axis.x) < 1e-7)
  assert.ok(centerline.x * geometry.axis.x + centerline.y * geometry.axis.y > 0)
})

test('single-beam geometry uses a downward axis for a coincident lamp and target', () => {
  const snapshot = {
    lampXRatio: 0.5,
    lampYRatio: 0.5,
    lightXRatio: 0.5,
    lightYRatio: 0.5,
    lampAngle: 0,
  }
  const geometry = computeSingleBeamGeometry(snapshot, 390, 844)
  assert.deepEqual(geometry.axis, { x: 0, y: 1 })
  for (const corner of viewportCorners(390, 844)) {
    assert.ok(pointInsideConvexPolygon(corner, geometry.end))
  }
})

test('single-beam final vertices overshoot instead of mapping to viewport corners', () => {
  const geometry = computeSingleBeamGeometry(DEFAULT_AUTH_LIGHT_SNAPSHOT, 1440, 900)
  for (const vertex of geometry.end) {
    assert.ok(vertex.x < 0 || vertex.x > 1440 || vertex.y < 0 || vertex.y > 900)
    assert.equal(
      viewportCorners(1440, 900).some(
        corner => Math.abs(corner.x - vertex.x) < 0.01 && Math.abs(corner.y - vertex.y) < 0.01,
      ),
      false,
    )
  }
})
```

- [ ] **Step 2: Run the unit test and verify RED**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts
```

Expected: FAIL because `computeSingleBeamGeometry`, `BeamPoint`, and `BeamPolygon` do not exist.

- [ ] **Step 3: Implement the pure geometry function**

Add these exports beside the existing snapshot types:

```ts
export interface BeamPoint {
  x: number
  y: number
}

export type BeamPolygon = readonly [BeamPoint, BeamPoint, BeamPoint, BeamPoint]

export interface SingleBeamGeometry {
  start: BeamPolygon
  end: BeamPolygon
  axis: BeamPoint
  startBackward: number
  startForward: number
  startNearHalfWidth: number
  startFarHalfWidth: number
  endBackward: number
  endForward: number
  endNearHalfWidth: number
  endFarHalfWidth: number
}
```

Implement the calculation as a pure function:

```ts
function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function computeSingleBeamGeometry(
  snapshot: AuthLightSnapshot,
  viewportWidth: number,
  viewportHeight: number,
): SingleBeamGeometry {
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1
  const lamp = {
    x: clampRatio(snapshot.lampXRatio) * width,
    y: clampRatio(snapshot.lampYRatio) * height,
  }
  const target = {
    x: clampRatio(snapshot.lightXRatio) * width,
    y: clampRatio(snapshot.lightYRatio) * height,
  }
  const deltaX = target.x - lamp.x
  const deltaY = target.y - lamp.y
  const distance = Math.hypot(deltaX, deltaY)
  const axis = distance > 0.001
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
  const minLongitudinal = Math.min(...projected.map(point => point.longitudinal))
  const maxLongitudinal = Math.max(...projected.map(point => point.longitudinal))
  const maximumPerpendicular = Math.max(
    ...projected.map(point => Math.abs(point.perpendicular)),
  )
  const startBackward = 6
  const startForward = Math.max(80, distance + clamp(distance * 0.12, 36, 100))
  const startNearHalfWidth = 4
  const startFarHalfWidth = clamp(distance * 0.22, 48, Math.min(width, height) * 0.2)
  const endBackward = Math.max(0, -minLongitudinal) + overscan
  const endForward = Math.max(0, maxLongitudinal) + overscan
  const endNearHalfWidth = maximumPerpendicular + overscan
  const endFarHalfWidth = endNearHalfWidth * 1.08

  const fromLocal = (x: number, y: number): BeamPoint => ({
    x: lamp.x + perpendicular.x * x + axis.x * y,
    y: lamp.y + perpendicular.y * x + axis.y * y,
  })
  const polygon = (
    backward: number,
    forward: number,
    nearHalfWidth: number,
    farHalfWidth: number,
  ): BeamPolygon => [
    fromLocal(-nearHalfWidth, -backward),
    fromLocal(nearHalfWidth, -backward),
    fromLocal(farHalfWidth, forward),
    fromLocal(-farHalfWidth, forward),
  ]

  return {
    start: polygon(startBackward, startForward, startNearHalfWidth, startFarHalfWidth),
    end: polygon(endBackward, endForward, endNearHalfWidth, endFarHalfWidth),
    axis,
    startBackward,
    startForward,
    startNearHalfWidth,
    startFarHalfWidth,
    endBackward,
    endForward,
    endNearHalfWidth,
    endFarHalfWidth,
  }
}
```

- [ ] **Step 4: Run the unit tests and verify GREEN**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts
```

Expected: all controller and geometry tests PASS.

### Task 2: Render Only the Existing Beam

**Files:**
- Modify: `src/components/auth/LoginBeamTransition.vue`
- Test: `tests/loginBeamTransitionIntegration.test.ts`

**Interfaces:**
- Consumes: `computeSingleBeamGeometry()` and the controller's frozen snapshot.
- Produces: CSS variables `--beam-start-{1..4}-{x|y}` and `--beam-end-{1..4}-{x|y}`.

- [ ] **Step 1: Replace the obsolete opening-layer tests with failing single-beam contracts**

Update integration assertions to require:

```ts
test('the existing beam alone grows beyond the viewport without a substitute wash', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')

  assert.equal((component.match(/class="beam-aperture"/g) ?? []).length, 1)
  assert.doesNotMatch(component, /beam-wash|beam-hotspot|login-beam-wash/)
  assert.doesNotMatch(component, /(?:-webkit-)?mask-image\s*:|radial-gradient\(circle/)
  assert.doesNotMatch(
    component,
    /clip-path:\s*polygon\(0 0,\s*100% 0,\s*100% 100%,\s*0 100%\)/,
  )

  for (let point = 1; point <= 4; point += 1) {
    assert.match(component, new RegExp(`--beam-start-${point}-x`))
    assert.match(component, new RegExp(`--beam-start-${point}-y`))
    assert.match(component, new RegExp(`--beam-end-${point}-x`))
    assert.match(component, new RegExp(`--beam-end-${point}-y`))
  }

  const start = keyframeDeclarations(component, 'login-beam-zoom', 0)
  const full = keyframeDeclarations(component, 'login-beam-zoom', 56)
  assert.match(start, /clip-path:\s*polygon\([\s\S]*--beam-start-1-x/)
  assert.match(full, /clip-path:\s*polygon\([\s\S]*--beam-end-1-x/)
  assert.match(full, /opacity:\s*1;/)
})

test('single-beam brightness rises monotonically until full coverage', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  assert.deepEqual(
    [0, 16, 40, 56].map(value => keyframeOpacity(component, 'login-beam-zoom', value)),
    [0.08, 0.18, 0.52, 1],
  )
})
```

Remove `.beam-wash` from pointer-event, animation, fade-mode, and cleanup selector lists. Keep the existing post-coverage panel assertions unchanged because Dashboard reveal is out of scope.

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```powershell
node --test tests/loginBeamTransitionIntegration.test.ts
```

Expected: FAIL because `.beam-wash` still exists and `.beam-aperture` does not bind calculated polygon points.

- [ ] **Step 3: Bind the calculated geometry in the component**

Import the function and construct CSS variables in `transitionStyle`:

```ts
import {
  cancelLoginBeamTransition,
  computeSingleBeamGeometry,
  loginBeamTransitionState as state,
} from './loginBeamTransition'

const transitionStyle = computed(() => {
  const snapshot = state.snapshot
  const viewportWidth = typeof window === 'undefined' ? 1 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 1 : window.innerHeight
  const geometry = computeSingleBeamGeometry(snapshot, viewportWidth, viewportHeight)
  const points: Record<string, string> = {}

  for (const [phase, polygon] of [['start', geometry.start], ['end', geometry.end]] as const) {
    polygon.forEach((point, index) => {
      points[`--beam-${phase}-${index + 1}-x`] = `${point.x}px`
      points[`--beam-${phase}-${index + 1}-y`] = `${point.y}px`
    })
  }

  return {
    '--lamp-x': `${snapshot.lampXRatio * 100}%`,
    '--lamp-y': `${snapshot.lampYRatio * 100}%`,
    '--light-x': `${snapshot.lightXRatio * 100}%`,
    '--light-y': `${snapshot.lightYRatio * 100}%`,
    '--lamp-angle': `${-snapshot.lampAngle}rad`,
    '--beam-gradient-angle': `${Math.atan2(geometry.axis.x, -geometry.axis.y)}rad`,
    ...points,
  }
})
```

Delete `<div class="beam-wash"></div>`. Replace the transformed large canvas declarations on `.beam-aperture` with a full-overlay polygon:

```css
.beam-aperture {
  inset: 0;
  z-index: 4;
  clip-path: polygon(
    var(--beam-start-1-x) var(--beam-start-1-y),
    var(--beam-start-2-x) var(--beam-start-2-y),
    var(--beam-start-3-x) var(--beam-start-3-y),
    var(--beam-start-4-x) var(--beam-start-4-y)
  );
  background: linear-gradient(
    var(--beam-gradient-angle),
    rgba(255, 250, 232, 0.32),
    rgba(255, 224, 164, 0.72) 42%,
    var(--transition-cover) 100%
  );
  opacity: 0.08;
  will-change: clip-path, opacity;
  animation: login-beam-zoom 1100ms cubic-bezier(0.2, 0.72, 0.16, 1) both;
}
```

Replace `login-beam-zoom` transform keyframes with polygon keyframes:

```css
@keyframes login-beam-zoom {
  0% {
    clip-path: polygon(
      var(--beam-start-1-x) var(--beam-start-1-y),
      var(--beam-start-2-x) var(--beam-start-2-y),
      var(--beam-start-3-x) var(--beam-start-3-y),
      var(--beam-start-4-x) var(--beam-start-4-y)
    );
    opacity: 0.08;
  }
  16% { opacity: 0.18; }
  40% { opacity: 0.52; }
  56% {
    clip-path: polygon(
      var(--beam-end-1-x) var(--beam-end-1-y),
      var(--beam-end-2-x) var(--beam-end-2-y),
      var(--beam-end-3-x) var(--beam-end-3-y),
      var(--beam-end-4-x) var(--beam-end-4-y)
    );
    opacity: 1;
  }
  64% {
    clip-path: polygon(
      var(--beam-end-1-x) var(--beam-end-1-y),
      var(--beam-end-2-x) var(--beam-end-2-y),
      var(--beam-end-3-x) var(--beam-end-3-y),
      var(--beam-end-4-x) var(--beam-end-4-y)
    );
    opacity: 1;
  }
  68%,
  100% {
    clip-path: polygon(
      var(--beam-end-1-x) var(--beam-end-1-y),
      var(--beam-end-2-x) var(--beam-end-2-y),
      var(--beam-end-3-x) var(--beam-end-3-y),
      var(--beam-end-4-x) var(--beam-end-4-y)
    );
    opacity: 0;
  }
}
```

Remove all `.beam-wash` CSS and update fade selectors to hide only `.beam-aperture`, `.lamp-snapshot`, and `.route-cover`.

- [ ] **Step 4: Run focused integration tests and verify GREEN**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts
```

Expected: all transition tests PASS.

### Task 3: Authentication Regression And Build Verification

**Files:**
- Verify unchanged: `src/views/LoginView.vue`
- Verify unchanged: `src/views/SmartLightDashboard.vue`
- Modify: `output/playwright/login-beam-transition/capture-exact-keyframes.mjs`
- Modify: `output/playwright/login-beam-transition/verify-transition.mjs`

**Interfaces:**
- Consumes: `.beam-aperture` computed `clipPath` and the existing transition controller.
- Produces: deterministic desktop/mobile screenshots and JSON geometry reports.

- [ ] **Step 1: Update QA selectors**

Both scripts must report the existing beam and must not query a wash:

```js
beam: style('.beam-aperture'),
shield: style('.swap-shield'),
curtain: style('.route-cover'),
lamp: style('.lamp-snapshot'),
```

The style reader must include:

```js
clipPath: computed.clipPath,
opacity: Number(computed.opacity),
rect: {
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
},
```

- [ ] **Step 2: Run the complete focused suite**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts
```

Expected: all 49 existing tests plus the new geometry tests PASS.

- [ ] **Step 3: Run the production build and whitespace check**

Run:

```powershell
npm run build
git diff --check -- src/components/auth/LoginBeamTransition.vue src/components/auth/loginBeamTransition.ts tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts docs/superpowers/specs/2026-07-22-login-single-beam-fullscreen-expansion-design.md docs/superpowers/plans/2026-07-22-login-single-beam-fullscreen-expansion.md
```

Expected: TypeScript and Vite build PASS; `git diff --check` reports no errors. The existing large-chunk warning is acceptable.

### Task 4: Desktop And Mobile Visual Verification

**Files:**
- Run: `output/playwright/login-beam-transition/capture-exact-keyframes.mjs`
- Run: `output/playwright/login-beam-transition/verify-transition.mjs`
- Inspect: `output/playwright/login-beam-transition/desktop-exact-0120.png`
- Inspect: `output/playwright/login-beam-transition/desktop-exact-0400.png`
- Inspect: `output/playwright/login-beam-transition/desktop-exact-0616.png`
- Inspect: `output/playwright/login-beam-transition/mobile-exact-0120.png`
- Inspect: `output/playwright/login-beam-transition/mobile-exact-0400.png`
- Inspect: `output/playwright/login-beam-transition/mobile-exact-0616.png`

**Interfaces:**
- Consumes: running Vite app at `http://127.0.0.1:5173/`.
- Produces: screenshot evidence and JSON reports under `output/playwright/login-beam-transition/`.

- [ ] **Step 1: Capture exact paused frames**

Run:

```powershell
node output/playwright/login-beam-transition/capture-exact-keyframes.mjs
```

Expected: desktop `1440x900` and mobile `390x844` screenshots at `120ms`, `400ms`, and `616ms`, with no console errors.

- [ ] **Step 2: Verify the real login transition**

Run:

```powershell
node output/playwright/login-beam-transition/verify-transition.mjs 120 400 616
```

Expected: login stays on `/login` through `616ms`, the overlay is present, no horizontal overflow occurs, and the store-setup branch still navigates directly without the transition.

- [ ] **Step 3: Inspect screenshots and geometry**

At `120ms`, verify a narrow directional beam aligned from lamp to landing point. At `400ms`, verify the same beam is visibly wider and longer without becoming screen-shaped. At `616ms`, verify all four viewport corners are covered by that beam alone, with no circular edge, rectangular corner morph, auxiliary wash, or exposed pixel seam.

- [ ] **Step 4: Request final code review**

Review only the files listed in this plan. Reject any implementation that changes Login authentication logic, Dashboard code, layout/background styling, lamp geometry, or follow-light motion.
