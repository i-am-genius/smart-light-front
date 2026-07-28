import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  LOGIN_BEAM_ROUTE_SWAP_MS,
  LOGIN_BEAM_TOTAL_MS,
} from '../src/components/auth/loginBeamTransition.ts'

const root = new URL('../', import.meta.url)

async function read(path: string) {
  return readFile(new URL(path, root), 'utf8')
}

function cssDeclarations(source: string, selector: string) {
  const declarations: string[] = []

  for (const styleMatch of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const ruleMatch of styleMatch[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = ruleMatch[1].split(',').map(candidate => candidate.trim())
      if (selectors.includes(selector)) declarations.push(ruleMatch[2])
    }
  }

  assert.ok(declarations.length > 0, `Missing CSS rule for ${selector}`)
  return declarations
}

function numericCssProperty(source: string, selector: string, property: string) {
  for (const declarations of cssDeclarations(source, selector)) {
    const propertyMatch = declarations.match(
      new RegExp(`${property}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*;`),
    )
    if (propertyMatch) return Number(propertyMatch[1])
  }

  assert.fail(`Missing numeric ${property} for ${selector}`)
}

function keyframesBody(source: string, name: string) {
  const marker = `@keyframes ${name}`
  const markerIndex = source.indexOf(marker)
  assert.notEqual(markerIndex, -1, `Missing ${marker}`)

  const openIndex = source.indexOf('{', markerIndex)
  assert.notEqual(openIndex, -1, `Missing opening brace for ${marker}`)

  let depth = 0
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(openIndex + 1, index)
    }
  }

  assert.fail(`Missing closing brace for ${marker}`)
}

test('App mounts exactly one global login beam transition', async () => {
  const app = await read('src/App.vue')
  assert.match(app, /import LoginBeamTransition from ['"]\.\/components\/auth\/LoginBeamTransition\.vue['"]/)
  assert.equal((app.match(/<LoginBeamTransition\s*\/>/g) ?? []).length, 1)
})

test('the overlay consumes controller state without creating another WebGL scene', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  assert.match(component, /loginBeamTransitionState/)
  assert.match(component, /cancelLoginBeamTransition/)
  assert.match(component, /v-if="state\.active"/)
  assert.match(component, /--lamp-x/)
  assert.match(component, /--light-y/)
  assert.match(component, /'--lamp-angle':\s*`\$\{-snapshot\.lampAngle\}rad`/)
  assert.match(component, /is-aperture/)
  assert.match(component, /is-fade/)
  assert.match(component, /1100ms/)
  assert.doesNotMatch(component, /three|WebGLRenderer|requestAnimationFrame/i)
})

test('the controller uses aperture mode based only on polygon clip-path support', async () => {
  const controller = await read('src/components/auth/loginBeamTransition.ts')
  assert.match(controller, /CSS\.supports\(['"]clip-path['"], ['"]polygon\(/)
  assert.doesNotMatch(controller, /registerProperty|mask-image/)
})

test('the transition stays above the global toast layer', async () => {
  const [component, toast] = await Promise.all([
    read('src/components/auth/LoginBeamTransition.vue'),
    read('src/components/common/ToastContainer.vue'),
  ])

  const transitionZIndex = numericCssProperty(component, '.login-beam-transition', 'z-index')
  const toastZIndex = numericCssProperty(toast, '.toast-container', 'z-index')

  assert.ok(
    transitionZIndex > toastZIndex,
    `Expected transition z-index ${transitionZIndex} to exceed toast z-index ${toastZIndex}`,
  )
})

test('the route cover remains behind the visible beam and lamp', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  const routeCoverZIndex = numericCssProperty(component, '.route-cover', 'z-index')
  const beamZIndex = numericCssProperty(component, '.beam-aperture', 'z-index')
  const lampZIndex = numericCssProperty(component, '.lamp-snapshot', 'z-index')

  assert.ok(routeCoverZIndex < beamZIndex)
  assert.ok(beamZIndex < lampZIndex)
})

test('transition snapshot uses the selected track-cylinder parts without a cable', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  for (const part of [
    'lamp-model',
    'lamp-adapter',
    'lamp-joint',
    'lamp-barrel',
    'lamp-bezel',
    'lamp-lens',
  ]) {
    assert.match(component, new RegExp(`class="[^"]*${part}`))
  }

  assert.equal(
    (component.match(/class="[^"]*\blamp-heat-ring\b[^"]*"/g) ?? []).length,
    2,
  )
  assert.doesNotMatch(component, /lamp-(?:cable|cord|rail)/)
  assert.doesNotMatch(component, /\.lamp-snapshot::before/)

  const lamp = cssDeclarations(component, '.lamp-snapshot').join('\n')
  assert.match(lamp, /width:\s*88px;/)
  assert.match(lamp, /height:\s*112px;/)
  assert.match(lamp, /transform:\s*translate\(-50%,\s*-35%\) rotate\(var\(--lamp-angle\)\);/)

  const lens = cssDeclarations(component, '.lamp-lens').join('\n')
  assert.match(lens, /background:\s*radial-gradient\(/)
})

test('the overlay owns cleanup, pointer capture, and complete 1100ms animations', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  assert.match(component, /onBeforeUnmount\(cancelLoginBeamTransition\)/)
  assert.ok(
    cssDeclarations(component, '.login-beam-transition')
      .some(rule => /pointer-events:\s*auto;/.test(rule)),
  )

  for (const selector of [
    '.beam-aperture',
    '.lamp-snapshot',
    '.route-cover',
    '.reveal-panel',
    '.swap-shield',
  ]) {
    assert.ok(
      cssDeclarations(component, selector)
        .some(rule => /pointer-events:\s*none;/.test(rule)),
      `Expected ${selector} to ignore pointer events`,
    )
  }

  const animations = [
    ['.lamp-snapshot', 'login-lamp-release'],
    ['.route-cover', 'login-curtain-handoff'],
    ['.reveal-panel--top', 'login-dashboard-open-top'],
    ['.reveal-panel--bottom', 'login-dashboard-open-bottom'],
    ['.reveal-panel--left', 'login-dashboard-open-left'],
    ['.reveal-panel--right', 'login-dashboard-open-right'],
    ['.swap-shield', 'login-swap-shield'],
    ['.is-fade .swap-shield', 'login-route-fade'],
  ] as const

  for (const [selector, name] of animations) {
    assert.ok(
      cssDeclarations(component, selector)
        .some(rule => new RegExp(`animation:\\s*${name}\\s+1100ms\\b`).test(rule)),
      `Expected ${selector} to run ${name} for 1100ms`,
    )
  }

  for (const selector of [
    '.is-fade .beam-aperture',
    '.is-fade .lamp-snapshot',
    '.is-fade .route-cover',
  ]) {
    assert.ok(
      cssDeclarations(component, selector).some(rule => /display:\s*none;/.test(rule)),
      `Expected fade mode to hide ${selector}`,
    )
  }

})

test('the opening beam has only two unique geometry states', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')

  assert.match(component, /computeContinuousFanGeometry/)
  assert.equal((component.match(/class="beam-aperture"/g) ?? []).length, 1)
  assert.doesNotMatch(component, /beam-wash|beam-hotspot|login-beam-wash/)
  assert.doesNotMatch(component, /(?:-webkit-)?mask-image\s*:|radial-gradient\([^)]*clip/)

  for (let point = 1; point <= 3; point += 1) {
    assert.match(component, new RegExp(`--beam-start-${point}-x`))
    assert.match(component, new RegExp(`--beam-start-${point}-y`))
    assert.match(component, new RegExp(`--beam-end-${point}-x`))
    assert.match(component, new RegExp(`--beam-end-${point}-y`))
  }
  assert.doesNotMatch(component, /--beam-(?:start|end)-4-[xy]/)

  const beam = cssDeclarations(component, '.beam-aperture').join('\n')
  assert.match(
    beam,
    /animation:\s*login-beam-fan-open\s+1100ms\s+both,\s*login-beam-brightness\s+1100ms\s+linear\s+both;/,
  )

  const geometry = keyframesBody(component, 'login-beam-fan-open')
  assert.match(geometry, /0%\s*\{[\s\S]*--beam-start-1-x[\s\S]*--beam-start-3-y/)
  assert.match(geometry, /56%,\s*100%\s*\{[\s\S]*--beam-end-1-x[\s\S]*--beam-end-3-y/)
  assert.doesNotMatch(geometry, /(?:16|40|64|68)%|opacity\s*:/)
  assert.equal((geometry.match(/clip-path\s*:/g) ?? []).length, 2)

  const brightness = keyframesBody(component, 'login-beam-brightness')
  assert.match(brightness, /0%\s*\{\s*opacity:\s*0\.08;/)
  assert.match(brightness, /16%\s*\{\s*opacity:\s*0\.18;/)
  assert.match(brightness, /40%\s*\{\s*opacity:\s*0\.52;/)
  assert.match(brightness, /56%,\s*64%\s*\{\s*opacity:\s*1;/)
  assert.match(brightness, /68%,\s*100%\s*\{\s*opacity:\s*0;/)
  assert.doesNotMatch(brightness, /clip-path/)
})

test('fan brightness reaches full coverage before route navigation', () => {
  const fullCoverageMs = LOGIN_BEAM_TOTAL_MS * 0.56
  assert.ok(Math.abs(fullCoverageMs - 616) < Number.EPSILON * 1000)
  assert.equal(LOGIN_BEAM_ROUTE_SWAP_MS, 660)
  assert.equal(LOGIN_BEAM_TOTAL_MS, 1100)
  assert.ok(fullCoverageMs < LOGIN_BEAM_ROUTE_SWAP_MS)
})

test('the continuous fan derives its direction from the calculated geometry axis', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  assert.match(
    component,
    /import\s*\{[\s\S]*computeContinuousFanGeometry[\s\S]*\}\s*from ['"]\.\/loginBeamTransition['"]/,
  )
  assert.match(
    component,
    /const geometry = computeContinuousFanGeometry\(snapshot,\s*viewportWidth,\s*viewportHeight\)/,
  )
  assert.match(
    component,
    /'--beam-gradient-angle':\s*`\$\{Math\.atan2\(geometry\.axis\.x,\s*-geometry\.axis\.y\)\}rad`/,
  )

  const beam = cssDeclarations(component, '.beam-aperture').join('\n')
  assert.match(beam, /linear-gradient\(\s*var\(--beam-gradient-angle\),/)
  assert.doesNotMatch(beam, /rotate\(/)
})

test('dashboard opens as four rectangular panels from the frozen light point', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  const swapPercent = LOGIN_BEAM_ROUTE_SWAP_MS / LOGIN_BEAM_TOTAL_MS * 100
  assert.equal(swapPercent, 60)
  assert.ok(swapPercent > 56 && swapPercent < 64)

  const shieldHold = keyframesBody(component, 'login-swap-shield')
  assert.match(shieldHold, /56%,\s*64%\s*\{\s*opacity:\s*1;/)

  assert.equal((component.match(/class="reveal-panel reveal-panel--/g) ?? []).length, 4)

  const top = cssDeclarations(component, '.reveal-panel--top').join('\n')
  const bottom = cssDeclarations(component, '.reveal-panel--bottom').join('\n')
  const left = cssDeclarations(component, '.reveal-panel--left').join('\n')
  const right = cssDeclarations(component, '.reveal-panel--right').join('\n')

  assert.match(top, /height:\s*calc\(var\(--light-y\) \+ 1px\);/)
  assert.match(bottom, /height:\s*calc\(100% - var\(--light-y\) \+ 1px\);/)
  assert.match(left, /width:\s*calc\(var\(--light-x\) \+ 1px\);/)
  assert.match(right, /width:\s*calc\(100% - var\(--light-x\) \+ 1px\);/)

  assert.match(
    keyframesBody(component, 'login-dashboard-open-top'),
    /64%[\s\S]*var\(--light-y\)[\s\S]*94%[\s\S]*height:\s*0;/,
  )
  assert.match(
    keyframesBody(component, 'login-dashboard-open-bottom'),
    /64%[\s\S]*100% - var\(--light-y\)[\s\S]*94%[\s\S]*height:\s*0;/,
  )
  assert.match(
    keyframesBody(component, 'login-dashboard-open-left'),
    /64%[\s\S]*var\(--light-x\)[\s\S]*94%[\s\S]*width:\s*0;/,
  )
  assert.match(
    keyframesBody(component, 'login-dashboard-open-right'),
    /64%[\s\S]*100% - var\(--light-x\)[\s\S]*94%[\s\S]*width:\s*0;/,
  )

  const curtain = cssDeclarations(component, '.route-cover').join('\n')
  const panels = [top, bottom, left, right].join('\n')
  assert.doesNotMatch(`${curtain}\n${panels}`, /radial-gradient|mask-image|border-radius/)
})

test('the overlay keeps full motion on mobile and reduced-motion environments', async () => {
  const component = await read('src/components/auth/LoginBeamTransition.vue')
  assert.match(component, /@media \(max-width:\s*760px\)/)
  assert.doesNotMatch(component, /prefers-reduced-motion/)
})

test('AuthFollowLight publishes the accepted lamp pose to the transition controller', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(
    component,
    /import \{ loginBeamTransitionState, recordAuthLightSnapshot \} from ['"]\.\/loginBeamTransition['"]/,
  )
  assert.match(component, /recordAuthLightSnapshot\(\{[\s\S]*lampX:\s*lampState\.position/)
  assert.match(component, /lampY:\s*lampScreenY/)
  assert.match(component, /lightX:\s*lightState\.x/)
  assert.match(component, /lightY:\s*lightState\.y/)
  assert.match(component, /lampAngle:\s*headAngle/)
  assert.match(component, /viewportWidth:\s*window\.innerWidth/)
  assert.match(component, /viewportHeight:\s*window\.innerHeight/)
})

test('AuthFollowLight freezes its last published pose while the login transition is active', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(
    component,
    /function animate\(time: number\) \{\s*animationFrame = 0\s*if \(loginBeamTransitionState\.active\) return\s*if \(isStaticMode\(\)\)/,
  )
  assert.match(
    component,
    /function startAnimation\(\) \{\s*if \(loginBeamTransitionState\.active\) return\s*if \(!threeReady \|\| isStaticMode\(\) \|\| animationFrame\) return\s*lastTime = performance\.now\(\)\s*animationFrame = requestAnimationFrame\(animate\)/,
  )
  assert.match(
    component,
    /function handleModeChange\(\) \{\s*if \(loginBeamTransitionState\.active\) return\s*if \(animationFrame\) \{[\s\S]*?\}\s*resizeThree\(\)\s*applyStaticState\(\)/,
  )
})

test('Login uses the transition only for the dashboard branch', async () => {
  const login = await read('src/views/LoginView.vue')
  assert.match(login, /import \{ playLoginBeamTransition \} from ['"]\.\.\/components\/auth\/loginBeamTransition['"]/)
  assert.match(
    login,
    /if \(data\.storeConfigured === false\) \{\s*router\.push\(['"]\/store-setup['"]\)\s*\} else \{\s*await playLoginBeamTransition\(\(\) => router\.push\(['"]\/smartlightdashboard['"]\)\)\s*\}/,
  )
})

test('the dashboard has no transition-specific implementation', async () => {
  const dashboard = await read('src/views/SmartLightDashboard.vue')
  assert.doesNotMatch(dashboard, /LoginBeamTransition|loginBeamTransition|login-beam-transition/)
})

test('visual QA captures early fan frames and every structured lamp part', async () => {
  const exactFrames = await read('output/playwright/login-beam-transition/capture-exact-keyframes.mjs')
  const realFlow = await read('output/playwright/login-beam-transition/verify-transition.mjs')

  assert.match(exactFrames, /const preRouteFrames = \[20, 50, 120, 400, 616\]/)
  assert.match(realFlow, /\[20, 50, 120, 400, 616, 680, 820, 1100\]/)

  for (const source of [exactFrames, realFlow]) {
    assert.match(source, /const lampParts = Object\.fromEntries/)
    assert.match(source, /\.lamp-snapshot \.\$\{className\}/)
    assert.match(source, /async function installWebSocketMock\(context\)/)
    for (const className of [
      'lamp-adapter',
      'lamp-joint',
      'lamp-barrel',
      'lamp-heat-ring--one',
      'lamp-heat-ring--two',
      'lamp-bezel',
      'lamp-lens',
    ]) {
      assert.match(source, new RegExp(`['"]${className}['"]`))
    }
    assert.match(source, /lampParts,/)
  }
})
