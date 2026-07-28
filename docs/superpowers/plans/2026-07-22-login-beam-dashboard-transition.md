# Trapezoid Login Beam And Rectangular Dashboard Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected circular expansion with an approved A transition: a dim trapezoid spotlight morphs into the full viewport, then the dashboard opens from the same light landing point through four retracting rectangular panels.

**Architecture:** Keep the existing singleton controller, `1100ms` timeline, and global overlay. Replace `.beam-hotspot` with a full-viewport `.beam-wash` animated by four-point `clip-path`; replace the radial mask with top, bottom, left, and right curtain panels whose dimensions retract to expose a growing rectangle without scaling dashboard content.

**Tech Stack:** Vue 3, TypeScript, CSS polygon `clip-path`, CSS transforms and keyframes, Node test runner, Playwright/Edge visual QA.

## Global Constraints

- Complete coverage remains `616ms` (`56%`), route swap remains `660ms` (`60%`), dashboard opening starts at `704ms` (`64%`), and completion remains `1100ms`.
- Brightness remains strictly increasing at `0%`, `16%`, `40%`, and `56%`: `0.08`, `0.18`, `0.52`, `1`.
- At `56%`, `.beam-wash` must use `clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%)`.
- The transition may not use a circular hotspot, `border-radius: 50%`, a radial gradient, a radial mask, or a rounded reveal aperture.
- Dashboard reveal uses exactly four opaque panels. Their shared inner corner starts at frozen `--light-x`/`--light-y`, then each panel retracts toward its corresponding viewport edge.
- Do not scale Dashboard DOM content.
- Do not modify Login business logic, auth persistence, the `/store-setup` branch, dashboard code, page layout, page backgrounds, auth lamp geometry, follower physics, or pointer-follow behavior.
- Keep full motion on desktop, mobile, and reduced-motion environments.
- Do not stage or commit implementation files.

---

### Task 1: Write The Non-Circular Visual Contracts

**Files:**
- Modify: `tests/loginBeamTransition.test.ts`
- Modify: `tests/loginBeamTransitionIntegration.test.ts`

**Interfaces:**
- Consumes: `LOGIN_BEAM_ROUTE_SWAP_MS`, `LOGIN_BEAM_TOTAL_MS`, controller mode selection, and the source of `LoginBeamTransition.vue`.
- Produces: failing tests for polygon coverage, absence of circular effects, exact four-panel geometry, and the simpler clip-path support contract.

- [ ] **Step 1: Require aperture mode without registered custom properties**

Replace the old custom-property fallback test with:

```ts
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
    if (originalCss) Object.defineProperty(globalThis, 'CSS', originalCss)
    else Reflect.deleteProperty(globalThis, 'CSS')
  }
})
```

- [ ] **Step 2: Replace the hotspot test with the trapezoid-to-rectangle contract**

```ts
test('the trapezoid beam wash brightens and becomes the full viewport before navigation', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  const opacities = [0, 16, 40, 56].map(percentage =>
    keyframeOpacity(component, 'login-beam-wash', percentage),
  )

  assert.deepEqual(opacities, [0.08, 0.18, 0.52, 1])
  assert.ok(opacities.every((opacity, index) => index === 0 || opacity > opacities[index - 1]))

  const wash = cssDeclarations(component, '.beam-wash').join('\n')
  assert.match(wash, /inset:\s*0;/)
  assert.match(wash, /animation:\s*login-beam-wash\s+1100ms/)
  assert.doesNotMatch(wash, /border-radius|radial-gradient|mask-image/)

  const start = keyframeDeclarations(component, 'login-beam-wash', 0)
  assert.match(start, /var\(--lamp-x\)/)
  assert.match(start, /var\(--lamp-y\)/)
  assert.match(start, /var\(--light-x\)/)
  assert.match(start, /var\(--light-y\)/)

  const covered = keyframeDeclarations(component, 'login-beam-wash', 56)
  assert.match(covered, /clip-path:\s*polygon\(0 0,\s*100% 0,\s*100% 100%,\s*0 100%\);/)
  assert.ok(LOGIN_BEAM_TOTAL_MS * 0.56 < LOGIN_BEAM_ROUTE_SWAP_MS)
})
```

- [ ] **Step 3: Require the four-panel rectangular reveal**

```ts
test('dashboard opens as four rectangular panels from the frozen light point', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  assert.equal((component.match(/class="reveal-panel reveal-panel--/g) ?? []).length, 4)

  const top = cssDeclarations(component, '.reveal-panel--top').join('\n')
  const bottom = cssDeclarations(component, '.reveal-panel--bottom').join('\n')
  const left = cssDeclarations(component, '.reveal-panel--left').join('\n')
  const right = cssDeclarations(component, '.reveal-panel--right').join('\n')

  assert.match(top, /height:\s*calc\(var\(--light-y\) \+ 1px\);/)
  assert.match(bottom, /height:\s*calc\(100% - var\(--light-y\) \+ 1px\);/)
  assert.match(left, /width:\s*calc\(var\(--light-x\) \+ 1px\);/)
  assert.match(right, /width:\s*calc\(100% - var\(--light-x\) \+ 1px\);/)

  assert.match(keyframesBody(component, 'login-dashboard-open-top'), /64%[\s\S]*var\(--light-y\)[\s\S]*94%[\s\S]*height:\s*0;/)
  assert.match(keyframesBody(component, 'login-dashboard-open-bottom'), /64%[\s\S]*100% - var\(--light-y\)[\s\S]*94%[\s\S]*height:\s*0;/)
  assert.match(keyframesBody(component, 'login-dashboard-open-left'), /64%[\s\S]*var\(--light-x\)[\s\S]*94%[\s\S]*width:\s*0;/)
  assert.match(keyframesBody(component, 'login-dashboard-open-right'), /64%[\s\S]*100% - var\(--light-x\)[\s\S]*94%[\s\S]*width:\s*0;/)

  const curtain = cssDeclarations(component, '.route-cover').join('\n')
  assert.doesNotMatch(curtain, /radial-gradient|mask-image|border-radius/)
})
```

Update existing animation and pointer contracts from `.beam-hotspot` to `.beam-wash`, and from one `login-dashboard-reveal` animation to the route-cover handoff plus the four directional panel animations.

- [ ] **Step 4: Verify RED**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts
```

Expected: FAIL because the current overlay still contains `.beam-hotspot`, `radial-gradient`, radial mask declarations, no reveal panels, and controller support still depends on `CSS.registerProperty`.

---

### Task 2: Implement The Trapezoid And Four-Panel Reveal

**Files:**
- Modify: `src/components/auth/loginBeamTransition.ts`
- Modify: `src/components/auth/LoginBeamTransition.vue`

**Interfaces:**
- Consumes: the existing normalized lamp and light snapshot.
- Produces: polygon aperture mode with no circular effects and a rectangular dashboard opening from the same frozen landing point.

- [ ] **Step 1: Simplify aperture feature detection**

```ts
function browserSupportsAperture() {
  if (typeof CSS === 'undefined') return false
  return CSS.supports('clip-path', 'polygon(0 0, 100% 0, 100% 100%)')
}
```

- [ ] **Step 2: Replace circular markup and add four panels**

```vue
<div class="route-cover">
  <span class="reveal-panel reveal-panel--top"></span>
  <span class="reveal-panel reveal-panel--bottom"></span>
  <span class="reveal-panel reveal-panel--left"></span>
  <span class="reveal-panel reveal-panel--right"></span>
</div>
<div class="swap-shield"></div>
<div class="beam-wash"></div>
<div class="beam-aperture"></div>
<div class="lamp-snapshot"><span></span></div>
```

- [ ] **Step 3: Implement the full-viewport beam wash**

```css
.beam-wash {
  inset: 0;
  z-index: 3;
  clip-path: polygon(
    calc(var(--lamp-x) - 0.4%) var(--lamp-y),
    calc(var(--lamp-x) + 0.4%) var(--lamp-y),
    calc(var(--light-x) + 4%) calc(var(--light-y) + 18%),
    calc(var(--light-x) - 4%) calc(var(--light-y) + 18%)
  );
  background: var(--transition-cover);
  opacity: 0.08;
  will-change: clip-path, opacity;
  animation: login-beam-wash 1100ms cubic-bezier(0.2, 0.72, 0.16, 1) both;
}

@keyframes login-beam-wash {
  0% {
    clip-path: polygon(
      calc(var(--lamp-x) - 0.4%) var(--lamp-y),
      calc(var(--lamp-x) + 0.4%) var(--lamp-y),
      calc(var(--light-x) + 4%) calc(var(--light-y) + 18%),
      calc(var(--light-x) - 4%) calc(var(--light-y) + 18%)
    );
    opacity: 0.08;
  }
  16% {
    clip-path: polygon(
      calc(var(--lamp-x) - 1.2%) var(--lamp-y),
      calc(var(--lamp-x) + 1.2%) var(--lamp-y),
      calc(var(--light-x) + 14%) calc(var(--light-y) + 28%),
      calc(var(--light-x) - 14%) calc(var(--light-y) + 28%)
    );
    opacity: 0.18;
  }
  40% {
    clip-path: polygon(
      calc(var(--lamp-x) - 22%) 0,
      calc(var(--lamp-x) + 22%) 0,
      100% 100%,
      0 100%
    );
    opacity: 0.52;
  }
  56% {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    opacity: 1;
  }
  64%, 100% {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    opacity: 0;
  }
}
```

- [ ] **Step 4: Implement four retracting panels**

```css
.route-cover {
  inset: 0;
  z-index: 1;
  opacity: 0;
  animation: login-curtain-handoff 1100ms linear both;
}

.reveal-panel {
  position: absolute;
  background: var(--transition-cover);
  will-change: width, height;
}

.reveal-panel--top {
  inset: 0 0 auto;
  height: calc(var(--light-y) + 1px);
  animation: login-dashboard-open-top 1100ms cubic-bezier(0.16, 0.82, 0.2, 1) both;
}

.reveal-panel--bottom {
  inset: auto 0 0;
  height: calc(100% - var(--light-y) + 1px);
  animation: login-dashboard-open-bottom 1100ms cubic-bezier(0.16, 0.82, 0.2, 1) both;
}

.reveal-panel--left {
  inset: 0 auto 0 0;
  width: calc(var(--light-x) + 1px);
  animation: login-dashboard-open-left 1100ms cubic-bezier(0.16, 0.82, 0.2, 1) both;
}

.reveal-panel--right {
  inset: 0 0 0 auto;
  width: calc(100% - var(--light-x) + 1px);
  animation: login-dashboard-open-right 1100ms cubic-bezier(0.16, 0.82, 0.2, 1) both;
}

@keyframes login-curtain-handoff {
  0%, 52% { opacity: 0; }
  56%, 100% { opacity: 1; }
}

@keyframes login-dashboard-open-top {
  0%, 64% { height: calc(var(--light-y) + 1px); }
  94%, 100% { height: 0; }
}

@keyframes login-dashboard-open-bottom {
  0%, 64% { height: calc(100% - var(--light-y) + 1px); }
  94%, 100% { height: 0; }
}

@keyframes login-dashboard-open-left {
  0%, 64% { width: calc(var(--light-x) + 1px); }
  94%, 100% { width: 0; }
}

@keyframes login-dashboard-open-right {
  0%, 64% { width: calc(100% - var(--light-x) + 1px); }
  94%, 100% { width: 0; }
}
```

Keep the existing cone angle, lamp snapshot, shield, fallback timing, and z-index order. Fade mode hides `.beam-wash`, cone, lamp, and route cover, then uses only the opaque shield.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts
```

Expected: all focused tests PASS.

---

### Task 3: Build, Exact-Keyframe QA, And Review

**Files:**
- Verify: `src/components/auth/LoginBeamTransition.vue`
- Verify: `src/components/auth/loginBeamTransition.ts`
- Verify unchanged: `src/views/LoginView.vue`
- Verify unchanged: `src/views/SmartLightDashboard.vue`
- Update QA source checks: `output/playwright/login-beam-transition/capture-exact-keyframes.mjs`

**Interfaces:**
- Consumes: completed A implementation.
- Produces: build, desktop/mobile screenshots, route release evidence, and independent review.

- [ ] **Step 1: Run build**

```powershell
npm run build
```

Expected: PASS with only the existing chunk-size warning.

- [ ] **Step 2: Capture exact desktop and mobile keyframes**

Capture `120ms`, `400ms`, `616ms`, `680ms`, `820ms`, and `1100ms` at `1440x900` and `390x844`.

Expected:

- `120ms`: dim narrow trapezoid, no circular patch;
- `400ms`: visibly wider and brighter trapezoid, still no circular edge;
- `616ms`: fully opaque warm viewport with all four corners covered;
- `680ms`: dashboard route mounted beneath a fully closed rectangular curtain;
- `820ms`: dashboard visible through a rectangular opening expanding from frozen `lightX`/`lightY`;
- `1100ms`: all four panels have retracted to the viewport edges and no overlay pixels remain visible.

- [ ] **Step 3: Verify real route cleanup and store-setup branch**

At desktop and mobile, submit a configured-store login and inspect after `1200ms`.

Expected: `/smartlightdashboard`, overlay absent, pointer input released, and no horizontal overflow. With `storeConfigured: false`, navigate directly to `/store-setup` and never mount the transition.

- [ ] **Step 4: Final automated checks**

```powershell
node --test tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts
npm run build
git diff --check -- src/components/auth/LoginBeamTransition.vue src/components/auth/loginBeamTransition.ts tests/loginBeamTransition.test.ts tests/loginBeamTransitionIntegration.test.ts docs/superpowers/specs/2026-07-22-login-beam-dashboard-transition-design.md docs/superpowers/plans/2026-07-22-login-beam-dashboard-transition.md
```

Expected: all tests and build PASS, no whitespace errors, no circular transition primitives, and unrelated worktree changes untouched.

- [ ] **Step 5: Request independent review**

Review the scoped diff for polygon interpolation, four-panel origin math, full opacity at route swap, fallback compatibility, timer cleanup, mobile overflow, and absence of dashboard coupling. Resolve every Critical or Important finding before handoff.
