import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function read(relativePath: string) {
  return readFile(new URL(relativePath, root), 'utf8')
}

function cssRule(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `Missing CSS rule: ${selector}`)
  return match[1]
}

test('the shared auth shell mounts one decorative follow light', async () => {
  const shell = await read('src/components/auth/AuthShell.vue')
  assert.match(shell, /import AuthFollowLight from ['"]\.\/AuthFollowLight\.vue['"]/)
  assert.match(shell, /<AuthFollowLight\s*\/?>/)
})

test('the auth shell uses the dark boutique scene without a white page wash', async () => {
  const shell = await read('src/components/auth/AuthShell.vue')
  assert.match(shell, /url\(['"]?\/backgrounds\/bg-night\.png['"]?\)/)
  assert.doesNotMatch(shell, /\.auth-page::after/)
  assert.doesNotMatch(shell, /url\(['"]?\/backgrounds\/bg-day\.png['"]?\)/)
})

test('the shared auth shell uses the approved deep gray glass tokens', async () => {
  const shell = await read('src/components/auth/AuthShell.vue')
  assert.match(cssRule(shell, '.auth-card'), /background:\s*rgba\(15, 20, 28, 0\.86\)/)
  assert.match(cssRule(shell, '.auth-brand-row strong'), /color:\s*#f2f5f9/)
  assert.match(cssRule(shell, '.form-header h2'), /color:\s*#f2f5f9/)
  assert.match(cssRule(shell, '.form-header p'), /color:\s*#9ba8b8/)
  assert.match(cssRule(shell, ':deep(.form-item label)'), /color:\s*#c9d1dc/)

  const input = cssRule(shell, ':deep(.form-item input)')
  assert.match(input, /background:\s*rgba\(5, 9, 15, 0\.72\)/)
  assert.match(input, /border:\s*1px solid #354152/)
  assert.match(input, /color:\s*#e6ecf3/)
  assert.match(cssRule(shell, ':deep(.form-item input::placeholder)'), /color:\s*#738094/)
})

test('login, registration, and store setup all consume the shared auth shell', async () => {
  for (const view of ['LoginView.vue', 'RegisterView.vue', 'StoreSetup.vue']) {
    const source = await read(`src/views/${view}`)
    assert.match(source, /<AuthShell\b/)
    assert.match(source, /import AuthShell from ['"]\.\.\/components\/auth\/AuthShell\.vue['"]/)
  }
})

test('mobile auth form stays vertically centered for the static spotlight', async () => {
  const shell = await read('src/components/auth/AuthShell.vue')
  const mobileLayout = shell.match(/@media \(max-width:\s*760px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(mobileLayout, /\.auth-page\s*\{[\s\S]*align-items:\s*center;/)
})

test('mobile static WebGL light composites above the form without blocking it', async () => {
  const shell = await read('src/components/auth/AuthShell.vue')
  const component = await read('src/components/auth/AuthFollowLight.vue')
  const mobileLighting = component.match(/@media \(max-width:\s*760px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(cssRule(shell, '.auth-shell'), /z-index:\s*2/)
  assert.match(mobileLighting, /\.webgl-canvas,[\s\S]*\.fallback-lamp\s*\{[\s\S]*z-index:\s*3/)
  assert.match(cssRule(component, '.webgl-canvas'), /pointer-events:\s*none/)
  assert.match(cssRule(component, '.fallback-lamp'), /pointer-events:\s*none/)
})

test('login and store setup special controls match the approved dark form', async () => {
  const login = await read('src/views/LoginView.vue')
  const storeSetup = await read('src/views/StoreSetup.vue')

  assert.match(cssRule(login, '.remember'), /color:\s*#9ba8b8/)
  assert.match(cssRule(login, '.checkbox-box'), /background:\s*rgba\(5, 9, 15, 0\.72\)/)

  const selectTrigger = cssRule(storeSetup, '.form-item :deep(.select-trigger)')
  assert.match(selectTrigger, /background:\s*rgba\(5, 9, 15, 0\.72\)/)
  assert.match(selectTrigger, /color:\s*#e6ecf3/)
  assert.match(
    cssRule(storeSetup, ':global(body:has(.auth-page) > .select-dropdown)'),
    /background:\s*#101722/,
  )
  assert.match(cssRule(storeSetup, '.setup-note'), /color:\s*#9ba8b8/)
})

test('dark materials preserve the accepted form geometry and interactions', async () => {
  const shell = await read('src/components/auth/AuthShell.vue')
  const storeSetup = await read('src/views/StoreSetup.vue')

  assert.match(cssRule(shell, '.auth-card'), /padding:\s*30px/)
  assert.match(cssRule(shell, '.auth-card'), /border-radius:\s*22px/)
  assert.match(cssRule(shell, '.brand-mark'), /width:\s*42px/)
  assert.match(cssRule(shell, '.brand-mark'), /height:\s*42px/)
  assert.match(cssRule(shell, ':deep(.form-item input)'), /height:\s*44px/)
  assert.match(cssRule(shell, ':deep(.form-item input)'), /border-radius:\s*12px/)
  assert.match(cssRule(shell, ':deep(.primary-btn)'), /height:\s*44px/)
  assert.match(cssRule(shell, ':deep(.primary-btn)'), /border-radius:\s*12px/)
  assert.doesNotMatch(shell, /primary-btn(?::hover[^}]*)?::after/)
  assert.doesNotMatch(shell, /form-footer a(?::hover)?::after/)
  assert.doesNotMatch(await read('src/views/LoginView.vue'), /forgot-link(?::hover)?::after/)

  const dropdown = cssRule(storeSetup, ':global(body:has(.auth-page) > .select-dropdown)')
  const option = cssRule(storeSetup, ':global(body:has(.auth-page) > .select-dropdown .select-option)')
  assert.doesNotMatch(dropdown, /max-height|border-radius/)
  assert.doesNotMatch(option, /min-height|border-radius/)
})

test('follow light keeps desktop pointer behavior and static accessibility modes', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(component, /import \* as THREE from ['"]three['"]/)
  assert.match(component, /advanceFollower/)
  assert.match(component, /matchMedia\(['"]\(min-width: 761px\)['"]\)/)
  assert.match(component, /matchMedia\(['"]\(prefers-reduced-motion: reduce\)['"]\)/)
  assert.match(component, /addEventListener\(['"]pointermove['"]/)
  assert.match(component, /removeEventListener\(['"]pointermove['"]/)
  assert.match(component, /cancelAnimationFrame/)
  assert.match(component, /renderer\.dispose\(\)/)
  assert.match(component, /let threeReady = false/)
  assert.match(component, /if \(!threeReady \|\| isStaticMode\(\) \|\| animationFrame\) return/)
  assert.match(component, /threeReady = true/)
  assert.match(component, /recordAuthLightSnapshot/)
  assert.match(component, /aria-hidden="true"/)
  assert.match(component, /pointer-events:\s*none/)
  assert.doesNotMatch(component, /pointerdown|pointerup|gravity|beamStartAngle|angleRange/)
})

test('follow light provides readable CSS lighting and a non-cable fallback lamp', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(component, /surface-darkness/)
  assert.match(component, /fallback-lamp/)
  assert.doesNotMatch(component, /surface-light/)
  assert.doesNotMatch(component, /surface-bloom/)
  assert.doesNotMatch(component, /surface-beam/)
  assert.doesNotMatch(component, /const rail|const ceilingCap|const cable/)
})

test('lighting uses the repository physical spotlight settings on an isolated, repository-scale receiver', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(component, /const REFERENCE_WORLD_SCALE = 0\.01/)
  assert.match(component, /const LIGHT_RECEIVER_Z = 0/)
  assert.match(component, /const LIGHT_SOURCE_Z = 1\.18/)
  assert.match(component, /let lightScene: THREE\.Scene \| null = null/)
  assert.match(component, /new THREE\.SpotLight\([\s\S]*18,[\s\S]*THREE\.MathUtils\.degToRad\(34\)[\s\S]*0\.88,[\s\S]*2,[\s\S]*\)/)
  assert.match(component, /spotLight\.power = 1450/)
  assert.match(component, /const lightReceiver = new THREE\.Mesh/)
  assert.match(component, /new THREE\.MeshStandardMaterial\([\s\S]*blending: THREE\.AdditiveBlending/)
  assert.match(component, /opacity: 0\.16/)
  assert.match(component, /lightScene\.add\(lightReceiver\)/)
  assert.match(component, /lightScene\.add\(spotLight, spotTarget\)/)
  assert.doesNotMatch(component, /scene\.add\(lightReceiver\)/)
  assert.doesNotMatch(component, /surface-form-fill/)
})

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
  for (const part of ['adapter', 'joint', 'barrel', 'bezel', 'lens']) {
    assert.match(component, new RegExp(`const ${part}\\b`))
  }
  assert.match(component, /new THREE\.BoxGeometry\(54, 14, 30\)/)
  assert.match(component, /new THREE\.CylinderGeometry\(7, 8, 18, 24\)/)
  assert.match(component, /new THREE\.CylinderGeometry\(37, 41, 44, 48\)/)
  assert.match(component, /new THREE\.TorusGeometry\(38\.5, 1\.25, 8, 48\)/)
  assert.match(component, /new THREE\.TorusGeometry\(42, 4\.2, 12, 64\)/)
  assert.match(component, /new THREE\.CircleGeometry\(36, 64\)/)
  assert.doesNotMatch(component, /LatheGeometry|shadeProfile|const shade\b|const cable\b|lamp-cable|lamp-cord|lamp-rail/)
})

test('live, fallback, and transition lamps share the approved 88 by 112 proportions', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(component, /const TRACK_LAMP_SCREEN_WIDTH = 88/)
  assert.match(component, /const TRACK_LAMP_MODEL_WIDTH = 92\.4/)
  assert.match(component, /const TRACK_LAMP_MOBILE_SCALE = 0\.78/)
  assert.match(component, /TRACK_LAMP_SCREEN_WIDTH\s*\/\s*TRACK_LAMP_MODEL_WIDTH/)
  assert.match(component, /mobile\s*\?\s*TRACK_LAMP_MOBILE_SCALE\s*:\s*1/)
  assert.match(cssRule(component, '.fallback-lamp'), /width:\s*88px/)
  assert.match(cssRule(component, '.fallback-lamp'), /height:\s*112px/)
  assert.match(component, /@media \(max-width: 760px\)[\s\S]*\.fallback-lamp\s*\{[\s\S]*--lamp-model-scale:\s*0\.78/)
})

test('spotlight origin is derived from the scaled lens position', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(component, /const TRACK_LENS_LOCAL_Y = -38\.5/)
  assert.match(component, /let lampModelScreenScale =/)
  assert.match(component, /TRACK_LENS_LOCAL_Y \* lampModelScreenScale/)
  assert.doesNotMatch(component, /\(lampY - 22\) \* REFERENCE_WORLD_SCALE/)
})

test('track spotlight preserves the approved follow and lighting behavior', async () => {
  const component = await read('src/components/auth/AuthFollowLight.vue')
  assert.match(component, /advanceFollower\(lampState, trackTarget, dt\)/)
  assert.match(component, /Math\.atan2\(lightState\.x - lampState\.position, Math\.max\(180, lightState\.y - lampScreenY\)\) \* 0\.36/)
  assert.match(component, /new THREE\.SpotLight\([\s\S]*THREE\.MathUtils\.degToRad\(34\)/)
  assert.match(component, /spotLight\.power = 1450/)
})
