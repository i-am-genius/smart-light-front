# Login Continuous Fan Beam And Track Spotlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing login beam open as one uninterrupted fan until it covers the viewport, and replace all auth lamp representations with the selected commercial track-cylinder spotlight.

**Architecture:** Replace the current four-corner beam expansion with a pure triangle geometry function whose start and end share one virtual hinge outside the viewport. Bind its three vertices to the existing `.beam-aperture` and animate geometry with one easing segment while opacity runs independently. Rebuild the existing Three.js lamp and both CSS lamp representations around one adapter/joint/barrel/bezel/lens silhouette without changing follow motion or route behavior.

**Tech Stack:** Vue 3, TypeScript, Three.js, CSS polygon `clip-path`, Node test runner, Playwright with Microsoft Edge.

## Global Constraints

- Opening illumination is rendered by exactly one existing `.beam-aperture` element.
- The beam itself must cover every viewport pixel by `616 ms`; route handoff remains `660 ms` and total duration remains `1100 ms`.
- Geometry has one start polygon and one distinct end polygon with one continuous easing segment; brightness keyframes are separate.
- No wash, hotspot, radial mask, circular reveal, viewport-corner morph, or rectangular substitute may produce opening coverage.
- The existing `swap-shield` remains transparent until full beam coverage and is retained only for route handoff.
- Use the selected commercial track-cylinder lamp with adapter, joint, cylindrical body, heat-sink detail, bezel, and recessed lens.
- Render no cable, hanging cord, or long rail.
- Do not modify authentication handlers, router guards, Dashboard code, auth layouts/backgrounds, follow equations, track range, or lamp-angle limits.
- Mobile and reduced-motion modes retain the existing static positioning behavior.
- Do not stage or commit any files.

---

## File Map

- `src/components/auth/loginBeamTransition.ts`: pure continuous-fan geometry and unchanged transition controller.
- `src/components/auth/LoginBeamTransition.vue`: three-point CSS variable binding, single-segment fan animation, and track-cylinder transition snapshot.
- `src/components/auth/AuthFollowLight.vue`: live Three.js track-cylinder lamp and matching CSS fallback.
- `tests/loginBeamTransition.test.ts`: viewport containment, shared hinge, monotonic expansion, and degenerate-input geometry tests.
- `tests/loginBeamTransitionIntegration.test.ts`: one-beam DOM/CSS contract, unique geometry states, timing, and transition lamp parts.
- `tests/authFollowLightIntegration.test.ts`: live/fallback track-cylinder contract and preservation of motion/lighting behavior.
- `output/playwright/login-beam-transition/capture-exact-keyframes.mjs`: exact-frame lamp-part and beam state capture.
- `output/playwright/login-beam-transition/verify-transition.mjs`: real-flow transition, coverage, overflow, and console-error checks.

---

### Task 1: Continuous Fan Geometry

**Files:**
- Modify: `src/components/auth/loginBeamTransition.ts`
- Test: `tests/loginBeamTransition.test.ts`

**Interfaces:**
- Consumes: `AuthLightSnapshot`, viewport width, and viewport height.
- Produces: `computeContinuousFanGeometry(snapshot, viewportWidth, viewportHeight): ContinuousFanGeometry`.
- Produces: `BeamTriangle = readonly [BeamPoint, BeamPoint, BeamPoint]`.
- `start[0]` and `end[0]` are the same virtual hinge.

- [ ] **Step 1: Replace quadrilateral assumptions with failing triangle contracts**

Update imports and polygon helpers in `tests/loginBeamTransition.test.ts`:

```ts
import {
  DEFAULT_AUTH_LIGHT_SNAPSHOT,
  computeContinuousFanGeometry,
  type BeamPoint,
  type BeamTriangle,
} from '../src/components/auth/loginBeamTransition.ts'

function pointInsideConvexPolygon(point: BeamPoint, polygon: readonly BeamPoint[]) {
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
```

Add focused contracts:

```ts
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
  ]) {
    const geometry = computeContinuousFanGeometry(snapshot, width, height)
    assert.deepEqual(geometry.start[0], geometry.end[0])
    assert.equal(geometry.start.length, 3)
    assert.equal(geometry.end.length, 3)
    for (const corner of viewportCorners(width, height)) {
      assert.ok(pointInsideConvexPolygon(corner, geometry.end))
    }
  }
})

test('continuous fan widens and lengthens around its fixed hinge', () => {
  const geometry = computeContinuousFanGeometry(DEFAULT_AUTH_LIGHT_SNAPSHOT, 1440, 900)
  assert.ok(geometry.pivotBackward > 0)
  assert.ok(geometry.endForward > geometry.startForward)
  assert.ok(geometry.endFarHalfWidth > geometry.startFarHalfWidth)
  assert.ok(
    geometry.endFarHalfWidth / (geometry.pivotBackward + geometry.endForward) >
    geometry.startFarHalfWidth / (geometry.pivotBackward + geometry.startForward),
  )
  assert.deepEqual(geometry.start[0], geometry.hinge)
  assert.deepEqual(geometry.end[0], geometry.hinge)
})

test('continuous fan keeps finite geometry for coincident targets and tiny viewports', () => {
  const geometry = computeContinuousFanGeometry(
    {
      lampXRatio: Number.NaN,
      lampYRatio: Number.POSITIVE_INFINITY,
      lightXRatio: Number.NEGATIVE_INFINITY,
      lightYRatio: Number.NaN,
      lampAngle: Number.NaN,
    },
    1,
    1,
  )
  assert.deepEqual(geometry.axis, { x: 0, y: 1 })
  for (const point of [...geometry.start, ...geometry.end]) {
    assert.ok(Number.isFinite(point.x))
    assert.ok(Number.isFinite(point.y))
  }
  for (const corner of viewportCorners(1, 1)) {
    assert.ok(pointInsideConvexPolygon(corner, geometry.end))
  }
})
```

Remove assertions tied to `startBackward`, `endBackward`, `startNearHalfWidth`, and `endNearHalfWidth`; those belong to the rejected trapezoid model.

- [ ] **Step 2: Run the geometry tests and verify the new API fails**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts
```

Expected: FAIL because `computeContinuousFanGeometry`, `BeamTriangle`, and `ContinuousFanGeometry` do not exist.

- [ ] **Step 3: Implement the minimal shared-hinge triangle geometry**

In `src/components/auth/loginBeamTransition.ts`, replace `BeamPolygon`, `SingleBeamGeometry`, and `computeSingleBeamGeometry` with:

```ts
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

const MAX_CONTINUOUS_FAN_SLOPE = 1.5

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
  const endForward = Math.max(maximumLongitudinal + overscan, startForward + overscan)
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
  const triangle = (forward: number, farHalfWidth: number): BeamTriangle => [
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
```

- [ ] **Step 4: Run geometry tests until they pass**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts
```

Expected: all controller tests and new fan geometry tests PASS.

- [ ] **Step 5: Review Task 1 without staging or committing**

Run:

```powershell
git diff --check -- src/components/auth/loginBeamTransition.ts tests/loginBeamTransition.test.ts
```

Expected: no whitespace errors.

---

### Task 2: Single-Segment Transition And Track-Cylinder Snapshot

**Files:**
- Modify: `src/components/auth/LoginBeamTransition.vue`
- Test: `tests/loginBeamTransitionIntegration.test.ts`

**Interfaces:**
- Consumes: `computeContinuousFanGeometry()` and `ContinuousFanGeometry.start/end`.
- Produces: CSS variables `--beam-start-{1..3}-{x|y}` and `--beam-end-{1..3}-{x|y}`.
- Produces: transition lamp parts `.lamp-adapter`, `.lamp-joint`, `.lamp-barrel`, `.lamp-heat-ring`, `.lamp-bezel`, and `.lamp-lens`.

- [ ] **Step 1: Add failing component contracts**

In `tests/loginBeamTransitionIntegration.test.ts`, replace four-point assumptions and add:

```ts
test('the opening beam has only two unique geometry states', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  assert.match(component, /computeContinuousFanGeometry/)
  assert.equal((component.match(/class="beam-aperture"/g) ?? []).length, 1)
  assert.doesNotMatch(component, /beam-wash|beam-hotspot|radial-gradient\([^)]*clip/)

  const geometry = keyframesBody(component, 'login-beam-fan-open')
  assert.match(geometry, /0%[\s\S]*--beam-start-1-x/)
  assert.match(geometry, /56%[\s\S]*--beam-end-1-x/)
  assert.doesNotMatch(geometry, /16%|40%/)
  assert.equal((geometry.match(/clip-path\s*:/g) ?? []).length, 2)

  const brightness = keyframesBody(component, 'login-beam-brightness')
  assert.match(brightness, /16%/)
  assert.match(brightness, /40%/)
  assert.doesNotMatch(brightness, /clip-path/)
})

test('transition snapshot uses the selected track-cylinder parts without a cable', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  for (const part of [
    'lamp-adapter',
    'lamp-joint',
    'lamp-barrel',
    'lamp-heat-ring',
    'lamp-bezel',
    'lamp-lens',
  ]) {
    assert.match(component, new RegExp(`class="[^"]*${part}`))
  }
  assert.doesNotMatch(component, /lamp-cable|lamp-cord|lamp-rail/)
})
```

Keep the existing assertions for `616 ms` full coverage, `660 ms` route swap, `1100 ms` completion, fallback fade mode, and Dashboard handoff layers.

- [ ] **Step 2: Run the integration tests and verify failure**

Run:

```powershell
node --test tests/loginBeamTransitionIntegration.test.ts
```

Expected: FAIL because the component still imports four-point geometry, uses `login-beam-zoom`, and renders the simplified lamp snapshot.

- [ ] **Step 3: Bind the three-point fan and structured lamp snapshot**

Update the template:

```vue
<div class="beam-aperture"></div>
<div class="lamp-snapshot">
  <span class="lamp-adapter"></span>
  <span class="lamp-joint"></span>
  <span class="lamp-barrel"></span>
  <span class="lamp-heat-ring lamp-heat-ring--one"></span>
  <span class="lamp-heat-ring lamp-heat-ring--two"></span>
  <span class="lamp-bezel"></span>
  <span class="lamp-lens"></span>
</div>
```

Update script binding:

```ts
import {
  cancelLoginBeamTransition,
  computeContinuousFanGeometry,
  loginBeamTransitionState as state,
} from './loginBeamTransition'

const geometry = computeContinuousFanGeometry(snapshot, viewportWidth, viewportHeight)
for (const [phase, polygon] of [['start', geometry.start], ['end', geometry.end]] as const) {
  polygon.forEach((point, index) => {
    points[`--beam-${phase}-${index + 1}-x`] = `${point.x}px`
    points[`--beam-${phase}-${index + 1}-y`] = `${point.y}px`
  })
}
```

The beam CSS must use three vertices and separate animations:

```css
.beam-aperture {
  inset: 0;
  z-index: 4;
  clip-path: polygon(
    var(--beam-start-1-x) var(--beam-start-1-y),
    var(--beam-start-2-x) var(--beam-start-2-y),
    var(--beam-start-3-x) var(--beam-start-3-y)
  );
  background: linear-gradient(
    var(--beam-gradient-angle),
    #fff8e8,
    #ffe0a4 42%,
    var(--transition-cover) 100%
  );
  opacity: 0.08;
  will-change: clip-path, opacity;
  animation:
    login-beam-fan-open 1100ms both,
    login-beam-brightness 1100ms linear both;
}

@keyframes login-beam-fan-open {
  0% {
    clip-path: polygon(
      var(--beam-start-1-x) var(--beam-start-1-y),
      var(--beam-start-2-x) var(--beam-start-2-y),
      var(--beam-start-3-x) var(--beam-start-3-y)
    );
    animation-timing-function: cubic-bezier(0.24, 0.02, 0.14, 1);
  }
  56%,
  100% {
    clip-path: polygon(
      var(--beam-end-1-x) var(--beam-end-1-y),
      var(--beam-end-2-x) var(--beam-end-2-y),
      var(--beam-end-3-x) var(--beam-end-3-y)
    );
  }
}

@keyframes login-beam-brightness {
  0% { opacity: 0.08; }
  16% { opacity: 0.18; }
  40% { opacity: 0.52; }
  56%, 64% { opacity: 1; }
  68%, 100% { opacity: 0; }
}
```

Style `.lamp-snapshot` as an 88-by-112 pixel coordinate box with the adapter at the top, joint below it, cylindrical barrel centered on the frozen pose, heat rings across the lower barrel, thick elliptical bezel, and recessed radial-gradient lens. Keep `transform: translate(-50%, -35%) rotate(var(--lamp-angle))`, the current z-index, release timing, and responsive scaling. Do not add a line above the adapter.

- [ ] **Step 4: Run transition component tests**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts
```

Expected: all transition geometry, controller, DOM, CSS, and timing contracts PASS.

- [ ] **Step 5: Review Task 2 without staging or committing**

Run:

```powershell
git diff --check -- src/components/auth/LoginBeamTransition.vue tests/loginBeamTransitionIntegration.test.ts
```

Expected: no whitespace errors.

---

### Task 3: Live WebGL And CSS Fallback Track Spotlight

**Files:**
- Modify: `src/components/auth/AuthFollowLight.vue`
- Test: `tests/authFollowLightIntegration.test.ts`
- Verify unchanged: `tests/authFollowLightMotion.test.ts`

**Interfaces:**
- Consumes: existing `lampRoot`, renderer lifecycle helpers, pose updates, and light state.
- Produces: the same named CSS parts as the transition snapshot.
- Preserves: `advanceFollower`, `clampTrackTarget`, `resolveDefaultLampX`, and the existing angle equation.

- [ ] **Step 1: Add failing live/fallback model contracts**

Replace the obsolete bell-lamp assertion in `tests/authFollowLightIntegration.test.ts` with:

```ts
test('follow light uses the track-cylinder model in WebGL and CSS fallback', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  for (const part of [
    'lamp-adapter',
    'lamp-joint',
    'lamp-barrel',
    'lamp-heat-ring',
    'lamp-bezel',
    'lamp-lens',
  ]) {
    assert.match(component, new RegExp(`class="[^"]*${part}`))
  }
  for (const mesh of ['adapter', 'joint', 'barrel', 'bezel', 'lens']) {
    assert.match(component, new RegExp(`const ${mesh}\\b`))
  }
  assert.match(component, /new THREE\.BoxGeometry\(/)
  assert.match(component, /new THREE\.CylinderGeometry\(/)
  assert.match(component, /new THREE\.TorusGeometry\(/)
  assert.match(component, /new THREE\.CircleGeometry\(/)
  assert.doesNotMatch(component, /LatheGeometry|shadeProfile|const shade\b|const cable\b|lamp-cable|lamp-cord/)
})

test('track spotlight preserves the approved follow and lighting behavior', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(component, /advanceFollower\(lampState, trackTarget, dt\)/)
  assert.match(component, /Math\.atan2\(lightState\.x - lampState\.position, Math\.max\(180, lightState\.y - lampScreenY\)\) \* 0\.36/)
  assert.match(component, /new THREE\.SpotLight\([\s\S]*THREE\.MathUtils\.degToRad\(34\)/)
  assert.match(component, /spotLight\.power = 1450/)
})
```

- [ ] **Step 2: Run auth-light tests and verify the lamp contract fails**

Run:

```powershell
node --test tests/authFollowLightIntegration.test.ts tests/authFollowLightMotion.test.ts
```

Expected: new model test FAILS while all motion tests remain PASS.

- [ ] **Step 3: Add structured fallback markup**

Replace the empty fallback element with:

```vue
<div ref="fallbackRef" class="fallback-lamp" aria-hidden="true">
  <span class="lamp-adapter"></span>
  <span class="lamp-joint"></span>
  <span class="lamp-barrel"></span>
  <span class="lamp-heat-ring lamp-heat-ring--one"></span>
  <span class="lamp-heat-ring lamp-heat-ring--two"></span>
  <span class="lamp-bezel"></span>
  <span class="lamp-lens"></span>
</div>
```

Keep `fallbackRef` positioning controlled only by the existing `setLampPose()` path. Replace `::before` and `::after` bell styles with the same adapter/joint/barrel/ring/bezel/lens proportions used by `LoginBeamTransition.vue`. Use CSS custom properties for scale and angle so the entire model transforms as one unit. Do not render a top line.

- [ ] **Step 4: Replace the bell meshes with track-cylinder primitives**

Inside `initThree()`, replace `shadeProfile`, `shade`, `rim`, `underside`, `connector`, and `bulb` with:

```ts
const darkMetal = createMaterial(new THREE.MeshStandardMaterial({
  color: 0x11151a,
  roughness: 0.34,
  metalness: 0.82,
}))
const bodyMetal = createMaterial(new THREE.MeshStandardMaterial({
  color: 0x252b31,
  roughness: 0.3,
  metalness: 0.78,
}))

const adapter = new THREE.Mesh(
  createGeometry(new THREE.BoxGeometry(54, 14, 30)),
  darkMetal,
)
adapter.position.y = 18
lampRoot.add(adapter)

const joint = new THREE.Mesh(
  createGeometry(new THREE.CylinderGeometry(7, 8, 18, 24)),
  darkMetal,
)
joint.position.y = 5
lampRoot.add(joint)

const barrel = new THREE.Mesh(
  createGeometry(new THREE.CylinderGeometry(37, 41, 44, 48)),
  bodyMetal,
)
barrel.position.y = -17
lampRoot.add(barrel)

for (const [index, y] of [-1, -10].entries()) {
  const heatRing = new THREE.Mesh(
    createGeometry(new THREE.TorusGeometry(38.5, 1.25, 8, 48)),
    darkMetal,
  )
  heatRing.name = `lamp-heat-ring-${index + 1}`
  heatRing.rotation.x = Math.PI / 2
  heatRing.position.y = y
  lampRoot.add(heatRing)
}

const bezel = new THREE.Mesh(
  createGeometry(new THREE.TorusGeometry(42, 4.2, 12, 64)),
  darkMetal,
)
bezel.rotation.x = Math.PI / 2
bezel.position.y = -39
lampRoot.add(bezel)

const lensMaterial = createMaterial(new THREE.MeshStandardMaterial({
  color: 0x332217,
  emissive: 0xffb36b,
  emissiveIntensity: 0.58,
  roughness: 0.82,
  side: THREE.DoubleSide,
}))
const lens = new THREE.Mesh(
  createGeometry(new THREE.CircleGeometry(36, 64)),
  lensMaterial,
)
lens.rotation.x = Math.PI / 2
lens.position.y = -38.5
lampRoot.add(lens)
```

Move the existing glow sprite and `bulbLight` to approximately `y = -39`, keep their existing color/intensity behavior, and retain the existing `spotLight`, target, receiver, renderer, and disposal logic. Adjust only `lampRoot` responsive scale if required to keep the selected B silhouette near the approved on-screen size; do not change positional or follow equations.

- [ ] **Step 5: Run live lamp and motion tests**

Run:

```powershell
node --test tests/authFollowLightIntegration.test.ts tests/authFollowLightMotion.test.ts
```

Expected: all track-model contracts and all unchanged motion tests PASS.

- [ ] **Step 6: Run the complete focused suite**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts
```

Expected: all focused auth-light tests PASS.

- [ ] **Step 7: Review Task 3 without staging or committing**

Run:

```powershell
git diff --check -- src/components/auth/AuthFollowLight.vue tests/authFollowLightIntegration.test.ts
```

Expected: no whitespace errors.

---

### Task 4: Exact-Frame Visual Verification

**Files:**
- Modify: `output/playwright/login-beam-transition/capture-exact-keyframes.mjs`
- Modify: `output/playwright/login-beam-transition/verify-transition.mjs`
- Generate: `output/playwright/login-beam-transition/exact-keyframes-report.json`
- Generate: `output/playwright/login-beam-transition/verification-report.json`
- Generate: desktop and mobile PNG captures under `output/playwright/login-beam-transition/`

**Interfaces:**
- Consumes: running Vite app at `http://127.0.0.1:5173/`.
- Produces: exact computed styles, screenshot evidence, corner coverage, lamp-part bounds, and console-error reports.

- [ ] **Step 1: Extend QA state reads for the structured lamp**

Add this helper to both QA scripts inside `page.evaluate()`:

```js
const lampParts = Object.fromEntries(
  [
    'lamp-adapter',
    'lamp-joint',
    'lamp-barrel',
    'lamp-heat-ring--one',
    'lamp-heat-ring--two',
    'lamp-bezel',
    'lamp-lens',
  ].map(className => [className, style(`.${className}`)]),
)
```

Return `lampParts` with each checkpoint. Retain `beam.clipPath`, `beam.opacity`, substitute-layer detection, overflow values, route path, and store-setup verification.

- [ ] **Step 2: Run exact paused captures**

Run:

```powershell
node output/playwright/login-beam-transition/capture-exact-keyframes.mjs
```

Expected: desktop `1440x900` and mobile `390x844` captures at `120 ms`, `400 ms`, and `616 ms`, with the structured lamp parts present and no console errors.

- [ ] **Step 3: Inspect the six opening screenshots**

Inspect:

```text
output/playwright/login-beam-transition/desktop-exact-0120.png
output/playwright/login-beam-transition/desktop-exact-0400.png
output/playwright/login-beam-transition/desktop-exact-0616.png
output/playwright/login-beam-transition/mobile-exact-0120.png
output/playwright/login-beam-transition/mobile-exact-0400.png
output/playwright/login-beam-transition/mobile-exact-0616.png
```

Required visual result:

- `120 ms`: narrow directional fan, subdued brightness, commercial track-cylinder lamp readable.
- `400 ms`: the same two side boundaries have moved continuously outward; no shape switch or intermediate crease.
- `616 ms`: beam is fully bright and its own triangle covers all four corners.
- Lamp adapter, joint, barrel, rings, bezel, and lens remain aligned with the frozen beam axis.
- No wire, rail line, auxiliary illumination, exposed seam, or horizontal overflow is visible.

- [ ] **Step 4: Verify the real login flow**

Run:

```powershell
node output/playwright/login-beam-transition/verify-transition.mjs 120 400 616
```

Expected:

- login route remains active through the opening checkpoints
- overlay and one beam are present
- `substituteWashPresent` is `false`
- all corner samples are covered at `616 ms`
- `scrollWidth` equals `clientWidth`
- no browser console errors
- unconfigured-store login still navigates directly to `/store-setup` without this transition

- [ ] **Step 5: Run final automated verification**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts
npm run build
git diff --check -- src/components/auth/loginBeamTransition.ts src/components/auth/LoginBeamTransition.vue src/components/auth/AuthFollowLight.vue tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts tests/authFollowLightIntegration.test.ts output/playwright/login-beam-transition/capture-exact-keyframes.mjs output/playwright/login-beam-transition/verify-transition.mjs docs/superpowers/specs/2026-07-23-login-continuous-fan-beam-track-spotlight-design.md docs/superpowers/plans/2026-07-23-login-continuous-fan-beam-track-spotlight.md
```

Expected: focused tests PASS, production build PASS, and no whitespace errors. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 6: Request a read-only final code review**

Review only the files listed in this plan. Reject changes to auth logic, router guards, Dashboard source, layouts/backgrounds, follow equations, track range, or angle limits. Resolve all Critical and Important findings before completion. Do not stage or commit.
