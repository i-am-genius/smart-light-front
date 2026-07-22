# Auth Light Follow Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one directly openable login-page HTML prototype that preserves the supplied layout and background, uses a readable warm spotlight, follows the desktop pointer without drag or swing, and remains static on mobile.

**Architecture:** Keep the form and page surface as real HTML. Render only the industrial hanging lamp on a transparent Three.js canvas and synchronize its landing point to CSS lighting layers. A small pure motion kernel inside the HTML provides non-linear, damped, non-overshooting horizontal following and can be extracted by the Node contract test.

**Tech Stack:** HTML5, CSS custom properties and masks, vanilla JavaScript, Three.js 0.185.0 loaded as an ES module, Node.js built-in test runner, Codex in-app Browser visual QA.

## Global Constraints

- Do not modify `src/components/auth/AuthShell.vue`, `src/views/LoginView.vue`, `src/views/RegisterView.vue`, or `src/views/StoreSetup.vue`.
- Preserve the supplied prototype's desktop and mobile layout and background.
- Desktop lamp movement requires no click or drag and must never swing or overshoot.
- Beam angle, brightness, and color are fixed and have no visible controls.
- Peripheral dimming stays within 12-18 percent so all content remains readable.
- Mobile and reduced-motion presentations are static and illuminate the login form by default.
- The login form remains real, keyboard-accessible HTML in normal and fallback states.

---

### Task 1: Prototype Contract And Motion Kernel

**Files:**
- Create: `tests/authLightFollowPrototype.test.mjs`
- Create: `docs/prototypes/auth-light-follow.html`

**Interfaces:**
- Consumes: The approved design in `docs/superpowers/specs/2026-07-22-auth-light-follow-prototype-design.md` and the supplied attachment HTML.
- Produces: `advanceFollower(state, target, dt)` returning `{ position: number, velocity: number }`, plus a directly openable HTML artifact.

- [ ] **Step 1: Write the failing contract test**

```js
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
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/authLightFollowPrototype.test.mjs`

Expected: FAIL with `ENOENT` for `docs/prototypes/auth-light-follow.html`.

- [ ] **Step 3: Create the readable surface and exact motion kernel**

The HTML must define this kernel between the test markers:

```js
/* MOTION_KERNEL_START */
function advanceFollower(state, target, dt) {
  const error = target - state.position
  const direction = Math.sign(error)
  const acceleration = direction * Math.min(2600, 90 * Math.pow(Math.abs(error), 0.72))
  const damping = Math.exp(-8.6 * dt)
  let velocity = (state.velocity + acceleration * dt) * damping
  const maxSpeed = 540
  velocity = Math.max(-maxSpeed, Math.min(maxSpeed, velocity))
  let position = state.position + velocity * dt
  if ((direction > 0 && position >= target) || (direction < 0 && position <= target)) {
    position = target
    velocity = 0
  }
  return { position, velocity }
}
/* MOTION_KERNEL_END */
```

The root lighting variables must include:

```css
:root {
  --lamp-color: #ffb36b;
  --lamp-rgb: 255, 179, 107;
  --light-x: 74%;
  --light-y: 48%;
  --peripheral-dim: .16;
  --spot-rx: 360px;
  --spot-ry: 285px;
}
```

The page surface must keep a permanent form fill and mild moving dim layer:

```css
.surface-form-fill {
  background: radial-gradient(ellipse 310px 270px at 79% 52%, rgba(255, 179, 107, .105), transparent 76%);
  mix-blend-mode: screen;
}

.surface-darkness {
  background: rgba(0, 0, 0, var(--peripheral-dim));
  mask-image: radial-gradient(ellipse var(--spot-rx) var(--spot-ry) at var(--light-x) var(--light-y), transparent 0 42%, #000 100%);
}
```

Desktop pointer handling must only update targets:

```js
window.addEventListener('pointermove', (event) => {
  if (!desktopFollow.matches) return
  pointerTarget.x = event.clientX
  pointerTarget.y = event.clientY
  startAnimation()
}, { passive: true })

document.documentElement.addEventListener('mouseleave', () => {
  pointerTarget.x = innerWidth * 0.68
  pointerTarget.y = innerHeight * 0.5
  startAnimation()
})
```

The mobile and reduced-motion branches must set the lamp and CSS variables once and avoid registering continuous follow behavior.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `node --test tests/authLightFollowPrototype.test.mjs`

Expected: 3 tests pass.

- [ ] **Step 5: Commit the tested prototype foundation**

```powershell
git add -- tests/authLightFollowPrototype.test.mjs docs/prototypes/auth-light-follow.html
git commit -m "feat: add readable auth light prototype"
```

---

### Task 2: Visual And Interaction Verification

**Files:**
- Modify: `docs/prototypes/auth-light-follow.html`
- Test: `tests/authLightFollowPrototype.test.mjs`

**Interfaces:**
- Consumes: The prototype and `advanceFollower` contract from Task 1.
- Produces: A visually approved desktop and mobile prototype with no console errors.

- [ ] **Step 1: Open the prototype in the in-app Browser at 1440 x 900**

Open the absolute local path to `docs/prototypes/auth-light-follow.html`. Capture an initial screenshot and inspect console errors.

Expected: The supplied layout and background remain intact; the lamp sits above the page; the login card is readable before any pointer movement.

- [ ] **Step 2: Verify delayed desktop following**

Move the pointer from the left third to the right third and capture screenshots during and after the movement.

Expected: The lamp body stays on its bounded top track, initially trails the pointer, accelerates over longer distances, brakes near the target, and does not oscillate. The warm landing point trails slightly and remains broadly feathered.

- [ ] **Step 3: Verify form interaction and fallback-safe readability**

Focus account and password inputs, toggle password visibility, toggle remember-me, and submit empty values.

Expected: Focus rings are visible, controls remain clickable, and validation text appears. Copy outside the hotspot remains readable without squinting.

- [ ] **Step 4: Verify mobile static behavior at 390 x 844**

Set the browser viewport to 390 x 844 and reload the prototype.

Expected: The supplied mobile layout remains unchanged, the lamp is static at top center, the fixed light covers the login card, and pointer movement does not start animation.

- [ ] **Step 5: Re-run automated checks and build**

Run: `node --test tests/authLightFollowPrototype.test.mjs`

Expected: 3 tests pass.

Run: `npm run build`

Expected: Vue type-check and Vite production build pass; no application source file was changed by the prototype.

- [ ] **Step 6: Commit visual tuning if the HTML changed during QA**

```powershell
git add -- docs/prototypes/auth-light-follow.html tests/authLightFollowPrototype.test.mjs
git commit -m "fix: tune auth light prototype motion"
```
