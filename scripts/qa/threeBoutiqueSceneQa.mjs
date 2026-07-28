import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'
import {
  EXPECTED_REAL_DEVICE_IDS,
  MIN_SPOTLIGHT_CONTRAST,
  MIN_SPOTLIGHT_FALLOFF,
  analyzeBoutiquePixels,
  buildChecks,
  classifyPerformanceEnvironment,
  isTextureWarning,
  parseSlotCountLabel,
  summarizeRafTimestamps,
} from './threeBoutiqueQaMetrics.mjs'

const baseUrl = process.env.THREE_QA_BASE_URL
  || 'http://127.0.0.1:5178/smartlightdashboard'
const outputDir = path.resolve('output/playwright')
const FPS_SAMPLE_MS = 1200
const BLANK_RAF_SAMPLE_MS = 700
const STORAGE_KEY = 'SMART_LIGHT_THREE_ZONE_LAYOUTS_V1'
const VIEWPORTS = [
  { width: 1920, height: 1080, label: '1920x1080', runInteractions: true },
  { width: 2560, height: 1440, label: '2560x1440', runInteractions: false },
]
const REQUIRED_TEXTURE_FILES = [
  'smoked-oak-color.png',
  'smoked-oak-height.png',
  'mineral-plaster-color.png',
  'mineral-plaster-height.png',
  'woven-fabric-height.png',
  'brushed-metal-roughness.png',
]

const devices = [
  {
    id: 101,
    chipId: 'qa-lamp-1',
    displayName: '新品展示区',
    deviceType: 'lamp',
    brightness: 72,
    temp: 3000,
    mainColorRgb: '#d45a48',
    online: true,
  },
  {
    id: 102,
    chipId: 'qa-lamp-2',
    displayName: '新品展示区',
    deviceType: 'lamp',
    brightness: 88,
    temp: 4000,
    mainColorRgb: '#8fb95a',
    online: true,
  },
]

await mkdir(outputDir, { recursive: true })

function responseFor(url) {
  const pathname = new URL(url).pathname
  if (pathname === '/api/store/current') {
    return {
      id: 'qa-store',
      userId: 'qa-user',
      storeName: '琥珀画廊验收店',
      storeStyle: 'HIGH_END',
      area: 80,
      province: '湖南省',
      city: '长沙市',
    }
  }
  if (pathname === '/admin/weather/current') {
    return {
      storeId: 'qa-store',
      temperature: 25,
      apparentTemperature: 26,
      humidity: 55,
      weatherCode: 1,
      weatherText: '多云',
    }
  }
  if (pathname === '/admin/device/my-list') return devices
  if (pathname === '/admin/device/online-list') {
    return devices.map(device => ({ chipId: device.chipId, online: true }))
  }
  if (pathname.includes('/locate/')) return true
  if (pathname.includes('trend')) return { labels: [], datasets: [] }
  if (pathname.includes('duration') || pathname.includes('strategy')) return {}
  return []
}

function activeSlots(stored) {
  const activeZoneId = stored?.activeZoneId || ''
  return stored?.zoneLayouts?.[activeZoneId]?.slots || []
}

function realDeviceIds(slots) {
  return slots
    .filter(slot => !slot.isManual && slot.sourceDeviceId !== undefined && slot.sourceDeviceId !== '')
    .map(slot => String(slot.sourceDeviceId))
    .sort()
}

function manualSlotCount(slots) {
  return slots.filter(slot => slot.isManual).length
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

async function readStoredSlots(page) {
  const stored = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)
  return activeSlots(stored ? JSON.parse(stored) : {})
}

async function waitForSlotCount(page, expected) {
  await page.waitForFunction((value) => {
    const text = document.querySelector('.scene-slot-count')?.textContent || ''
    const match = text.match(/^\s*(\d+)\s*个灯位\s*$/)
    return match ? Number(match[1]) === value : false
  }, expected)
  const text = await page.locator('.scene-slot-count').textContent()
  const actual = parseSlotCountLabel(text)
  if (actual !== expected) {
    throw new Error(`Expected exactly ${expected} lamp slots, received ${String(text).trim()}`)
  }
}

function installWebGlInstrumentation() {
  if (window.__THREE_BOUTIQUE_QA_WEBGL__) return
  const metrics = {
    instrumentationPatched: false,
    patchedMethods: [],
    drawCalls: 0,
    triangles: 0,
    texturesCreated: 0,
    texturesDeleted: 0,
  }
  window.__THREE_BOUTIQUE_QA_WEBGL__ = metrics

  const triangleCount = (mode, count, instances = 1) => {
    if (mode === 0x0004) return Math.floor(count / 3) * instances
    if (mode === 0x0005 || mode === 0x0006) return Math.max(0, count - 2) * instances
    return 0
  }
  const patch = (prototype, name, count) => {
    if (!prototype || Object.prototype.hasOwnProperty.call(prototype, `__qa_${name}`)) return
    const original = prototype[name]
    if (typeof original !== 'function') return
    Object.defineProperty(prototype, `__qa_${name}`, { value: true })
    Object.defineProperty(prototype, name, {
      configurable: true,
      writable: true,
      value(...args) {
        count(args)
        return Reflect.apply(original, this, args)
      },
    })
    metrics.instrumentationPatched = true
    metrics.patchedMethods.push(name)
  }
  const prototypes = [
    globalThis.WebGL2RenderingContext?.prototype,
    globalThis.WebGLRenderingContext?.prototype,
  ].filter(Boolean)

  for (const prototype of prototypes) {
    patch(prototype, 'drawArrays', ([mode, , count]) => {
      metrics.drawCalls += 1
      metrics.triangles += triangleCount(mode, count)
    })
    patch(prototype, 'drawElements', ([mode, count]) => {
      metrics.drawCalls += 1
      metrics.triangles += triangleCount(mode, count)
    })
    patch(prototype, 'drawArraysInstanced', ([mode, , count, instances]) => {
      metrics.drawCalls += 1
      metrics.triangles += triangleCount(mode, count, instances)
    })
    patch(prototype, 'drawElementsInstanced', ([mode, count, , , instances]) => {
      metrics.drawCalls += 1
      metrics.triangles += triangleCount(mode, count, instances)
    })
    patch(prototype, 'createTexture', () => { metrics.texturesCreated += 1 })
    patch(prototype, 'deleteTexture', () => { metrics.texturesDeleted += 1 })
  }
}

function emptyDiagnostics() {
  return {
    consoleErrors: [],
    consoleWarnings: [],
    textureWarnings: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    texture404s: [],
  }
}

function attachDiagnostics(page, diagnostics) {
  page.on('console', message => {
    const text = message.text()
    if (message.type() === 'error') diagnostics.consoleErrors.push(text)
    if (message.type() === 'warning') diagnostics.consoleWarnings.push(text)
    if (isTextureWarning(text)) diagnostics.textureWarnings.push(text)
  })
  page.on('pageerror', error => diagnostics.pageErrors.push(String(error)))
  page.on('requestfailed', request => {
    diagnostics.requestFailures.push({
      url: request.url(),
      error: request.failure()?.errorText || '',
    })
  })
  page.on('response', response => {
    if (response.status() < 400) return
    const entry = { url: response.url(), status: response.status() }
    diagnostics.httpErrors.push(entry)
    if (response.status() === 404 && /\/textures\/boutique\//.test(response.url())) {
      diagnostics.texture404s.push(entry)
    }
  })
}

async function configureContext(context) {
  await context.addInitScript(installWebGlInstrumentation)
  await context.addInitScript(() => {
    localStorage.setItem('TOKEN', 'qa-token')
    localStorage.setItem('USER_INFO', JSON.stringify({ id: 'qa-user', storeConfigured: true }))
    localStorage.setItem('storeSetup', JSON.stringify({ configured: true }))
    localStorage.setItem('SMART_LIGHT_LAYOUT_ZONES', JSON.stringify([
      { id: 'zone-a', name: '新品展示区' },
    ]))
    localStorage.removeItem('SMART_LIGHT_THREE_ZONE_LAYOUTS_V1')
  })
}

async function configurePage(context, diagnostics) {
  const page = await context.newPage()
  attachDiagnostics(page, diagnostics)
  await page.route('https://api.genius.show/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, msg: 'ok', data: responseFor(route.request().url()) }),
  }))
  await page.routeWebSocket('wss://api.genius.show/**', socket => socket.onMessage(() => {}))
  return page
}

async function measureRaf(page, sampleMs) {
  const sample = await page.evaluate(duration => new Promise((resolve) => {
    const timestamps = []
    let started = null
    const step = (now) => {
      if (started === null) {
        started = now
        timestamps.push(now)
        requestAnimationFrame(step)
        return
      }
      timestamps.push(now)
      if (now - started >= duration) {
        resolve({
          timestamps,
          visibilityState: document.visibilityState,
        })
      } else {
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)
  }), sampleMs)
  return {
    ...summarizeRafTimestamps(sample.timestamps),
    visibilityState: sample.visibilityState,
  }
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

async function measureFps(page) {
  const before = await page.evaluate(() => ({
    ...(window.__THREE_BOUTIQUE_QA_WEBGL__ || {}),
  }))
  const timing = await measureRaf(page, FPS_SAMPLE_MS)
  const after = await page.evaluate(() => ({
    ...(window.__THREE_BOUTIQUE_QA_WEBGL__ || {}),
  }))
  const drawCalls = Math.max(0, (after.drawCalls || 0) - (before.drawCalls || 0))
  const triangles = Math.max(0, (after.triangles || 0) - (before.triangles || 0))

  return {
    fps: timing.fps,
    durationMs: timing.durationMs,
    frameCount: timing.frameCount,
    p95FrameMs: percentile(timing.frameTimes, 0.95),
    visibilityState: timing.visibilityState,
    rendererInfo: {
      source: 'WebGL draw-call instrumentation (renderer.info equivalent)',
      instrumentationPatched: after.instrumentationPatched === true,
      patchedMethods: after.patchedMethods || [],
      calls: timing.frameCount ? drawCalls / timing.frameCount : null,
      triangles: timing.frameCount ? triangles / timing.frameCount : null,
      textures: after.texturesCreated === undefined
        ? null
        : Math.max(0, after.texturesCreated - after.texturesDeleted),
    },
  }
}

async function inspectRenderer(canvas) {
  return canvas.evaluate((element) => {
    const gl = element.getContext('webgl2') || element.getContext('webgl')
    if (!gl) {
      return {
        renderer: '',
        maskedRenderer: '',
        vendor: '',
        visibilityState: document.visibilityState,
        canvasSize: {
          width: element.width,
          height: element.height,
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
        },
      }
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : ''
    const vendor = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : ''
    return {
      renderer: String(renderer || ''),
      maskedRenderer: String(gl.getParameter(gl.RENDERER) || ''),
      vendor: String(vendor || ''),
      visibilityState: document.visibilityState,
      canvasSize: {
        width: element.width,
        height: element.height,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        drawingBufferWidth: gl.drawingBufferWidth,
        drawingBufferHeight: gl.drawingBufferHeight,
      },
    }
  })
}

async function hideUiOverlaysForSampling(page) {
  const style = await page.addStyleTag({
    content: [
      '.three-viewport-wrap .scene-toolbar,',
      '.three-viewport-wrap .scene-overlay,',
      '.three-viewport-wrap .scene-context-layer {',
      '  visibility: hidden !important;',
      '}',
    ].join('\n'),
  })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())))
  return async () => style.evaluate(element => element.remove())
}

async function sampleCanvas(page, canvas) {
  const restoreUi = await hideUiOverlaysForSampling(page)
  let screenshot
  try {
    screenshot = await canvas.screenshot({ animations: 'disabled' })
  } finally {
    await restoreUi()
  }
  const { data, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const analysis = analyzeBoutiquePixels(data, info)
  return {
    ...analysis,
    canvasSize: { width: info.width, height: info.height, channels: info.channels },
    sampling: {
      ...analysis.sampling,
      uiOverlaysHidden: true,
    },
  }
}

async function selectRenderedLamp(page, canvas) {
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  const xFractions = [0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88]
  const yFractions = [0.2, 0.26, 0.32, 0.38, 0.44, 0.5, 0.56, 0.62]
  for (const yFraction of yFractions) {
    for (const xFraction of xFractions) {
      await page.mouse.click(box.x + box.width * xFraction, box.y + box.height * yFraction)
      if (await page.locator('.scene-context-bar').isVisible()) {
        return { selected: true, xFraction, yFraction }
      }
    }
  }
  return { selected: false }
}

async function exerciseInteractions(page, canvas) {
  const initialSlots = await readStoredSlots(page)
  const initialSlotCount = initialSlots.length
  const initialRealDeviceIds = realDeviceIds(initialSlots)
  const initialManualSlotCount = manualSlotCount(initialSlots)
  const manufacturedSlotIds = initialSlots
    .map(slot => String(slot.slotId || ''))
    .filter(slotId => /placeholder-|mock-fallback/.test(slotId))

  const selection = await selectRenderedLamp(page, canvas)
  const deleteButton = page.locator('.scene-context-bar .context-action.danger')
  const realSelectionProtected = selection.selected
    && await deleteButton.isDisabled()
    && await deleteButton.getAttribute('title') === '真实设备灯位暂不能删除'

  const adjustButton = page.getByRole('button', { name: '调节', exact: true })
  const displayButton = page.getByRole('button', { name: '展示', exact: true })
  await adjustButton.click()
  const adjustPressed = await adjustButton.getAttribute('aria-pressed') === 'true'
  await displayButton.click()
  const displayPressed = await displayButton.getAttribute('aria-pressed') === 'true'

  await page.getByRole('button', { name: '添加灯位' }).click()
  await waitForSlotCount(page, 3)
  const afterAddSlots = await readStoredSlots(page)
  const afterAddSlotCount = afterAddSlots.length
  const manualSlotsAfterAdd = manualSlotCount(afterAddSlots)
  const realDeviceIdsAfterAdd = realDeviceIds(afterAddSlots)

  await page.locator('.scene-context-bar .context-action.danger').click()
  await waitForSlotCount(page, 2)
  const afterDeleteSlots = await readStoredSlots(page)
  const afterDeleteSlotCount = afterDeleteSlots.length
  const finalRealDeviceIds = realDeviceIds(afterDeleteSlots)
  const finalManualSlotCount = manualSlotCount(afterDeleteSlots)
  const realDeviceIdsPreserved = sameValues(initialRealDeviceIds, finalRealDeviceIds)
  const exactFixtureIds = sameValues(initialRealDeviceIds, EXPECTED_REAL_DEVICE_IDS)
    && sameValues(realDeviceIdsAfterAdd, EXPECTED_REAL_DEVICE_IDS)
    && sameValues(finalRealDeviceIds, EXPECTED_REAL_DEVICE_IDS)

  const pass = initialSlotCount === 2
    && exactFixtureIds
    && initialManualSlotCount === 0
    && manufacturedSlotIds.length === 0
    && realSelectionProtected
    && adjustPressed
    && displayPressed
    && afterAddSlotCount === 3
    && manualSlotsAfterAdd === 1
    && afterDeleteSlotCount === 2
    && finalManualSlotCount === 0
    && realDeviceIdsPreserved

  return {
    pass,
    initialSlotCount,
    initialSlotIds: initialSlots.map(slot => slot.slotId),
    initialRealDeviceIds,
    initialManualSlotCount,
    manufacturedSlotIds,
    selection,
    realSelectionProtected,
    viewModes: { adjustPressed, displayPressed },
    afterAddSlotCount,
    manualSlotsAfterAdd,
    realDeviceIdsAfterAdd,
    afterDeleteSlotCount,
    finalRealDeviceIds,
    finalManualSlotCount,
    realDeviceIdsPreserved,
  }
}

async function probeTextureAssets() {
  const origin = new URL(baseUrl).origin
  const probes = []
  for (const filename of REQUIRED_TEXTURE_FILES) {
    const filePath = path.resolve('src/assets/textures/boutique', filename)
    const url = new URL(`/src/assets/textures/boutique/${filename}`, origin).href
    let http = { status: null, contentType: '', imageResponse: false, error: '' }
    try {
      const response = await fetch(url, {
        headers: { accept: 'image/*' },
        signal: AbortSignal.timeout(5000),
      })
      const contentType = response.headers.get('content-type') || ''
      http = {
        status: response.status,
        contentType,
        imageResponse: response.ok && contentType.startsWith('image/'),
        error: '',
      }
      await response.body?.cancel()
    } catch (error) {
      http.error = String(error)
    }
    probes.push({ filename, filePath, fileExists: existsSync(filePath), url, http })
  }
  return probes
}

async function measureViewport(browser, viewport) {
  const diagnostics = emptyDiagnostics()
  let context = null
  try {
    context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      locale: 'zh-CN',
      reducedMotion: 'reduce',
    })
    await configureContext(context)
    const page = await configurePage(context, diagnostics)
    const blankPageBaseline = await measureRaf(page, BLANK_RAF_SAMPLE_MS)

    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    const canvas = page.locator('.three-layout-viewport canvas')
    await canvas.waitFor({ state: 'visible' })
    await page.locator('.scene-slot-count').waitFor({ state: 'visible' })
    await waitForSlotCount(page, 2)
    await page.waitForTimeout(900)

    const initialSlots = await readStoredSlots(page)
    const initialSlotCount = initialSlots.length
    const initialRealDeviceIds = realDeviceIds(initialSlots)
    const initialManualSlotCount = manualSlotCount(initialSlots)
    const manufacturedSlotIds = initialSlots
      .map(slot => String(slot.slotId || ''))
      .filter(slotId => /placeholder-|mock-fallback/.test(slotId))
    const rendererDetails = await inspectRenderer(canvas)

    // Performance is sampled before screenshots or GPU readback can stall the renderer.
    const performance = await measureFps(page)
    performance.environment = {
      ...classifyPerformanceEnvironment({
        renderer: rendererDetails.renderer,
        blankPageFps: blankPageBaseline.fps,
        visibilityState: rendererDetails.visibilityState,
      }),
      blankPageBaseline,
      maskedRenderer: rendererDetails.maskedRenderer,
      vendor: rendererDetails.vendor,
    }
    performance.canvasSize = rendererDetails.canvasSize

    const label = viewport.label
    await page.screenshot({
      path: path.join(outputDir, `three-boutique-${label}.png`),
      fullPage: false,
    })
    const pixels = await sampleCanvas(page, canvas)
    const interactions = viewport.runInteractions
      ? await exerciseInteractions(page, canvas)
      : null

    return {
      viewport: { width: viewport.width, height: viewport.height },
      label,
      initialSlotCount,
      initialSlotIds: initialSlots.map(slot => slot.slotId),
      initialRealDeviceIds,
      initialManualSlotCount,
      manufacturedSlotIds,
      pixels,
      performance,
      interactions,
      diagnostics,
    }
  } catch (error) {
    return {
      viewport: { width: viewport.width, height: viewport.height },
      label: viewport.label,
      error: String(error?.stack || error),
      diagnostics,
    }
  } finally {
    await context?.close().catch(() => {})
  }
}

const materialSourcePath = path.resolve('src/components/device/threeBoutiqueMaterials.ts')
const materialSource = await readFile(materialSourcePath, 'utf8')
const declaredTextureFiles = [...materialSource.matchAll(/boutique\/([^'"`]+\.png)/g)]
  .map(match => match[1])
  .sort()
const textureSpecsMatch = sameValues(
  declaredTextureFiles,
  [...REQUIRED_TEXTURE_FILES].sort(),
)
const textureProbes = await probeTextureAssets()

let browser = null
let browserVersion = ''
const results = []
let fatalError = null
try {
  browser = await chromium.launch({ headless: true })
  browserVersion = browser.version()
  for (const viewport of VIEWPORTS) {
    results.push(await measureViewport(browser, viewport))
  }
} catch (error) {
  fatalError = String(error?.stack || error)
} finally {
  await browser?.close()
}

const checkResult = buildChecks({
  fixtureDeviceIds: devices.map(device => device.id),
  expectedViewportCount: VIEWPORTS.length,
  requiredTextureFiles: REQUIRED_TEXTURE_FILES,
  textureProbes,
  textureSpecsMatch,
  fatalError,
  results,
})
const missingTextureAssets = checkResult.textureSummary.missingAssets
const primaryBlocker = missingTextureAssets.length > 0
  ? {
      code: 'texture-asset-missing',
      message: `texture asset missing: ${missingTextureAssets.map(asset => asset.filename).join(', ')}`,
      assets: missingTextureAssets,
    }
  : checkResult.checks.hardwarePerformanceEligible === false
    ? {
        code: 'hardware-performance-ineligible',
        message: 'Browser renderer or blank-page rAF baseline is not eligible for hardware FPS regression.',
      }
    : fatalError
      ? { code: 'fatal-error', message: fatalError }
      : checkResult.failedChecks.length > 0
        ? { code: 'qa-check-failed', message: `QA checks failed: ${checkResult.failedChecks.join(', ')}` }
        : null
const report = {
  pass: checkResult.pass,
  baseUrl,
  generatedAt: new Date().toISOString(),
  browser: { name: 'chromium', version: browserVersion, headless: true },
  thresholds: {
    canvasEntropy: '> 1',
    canvasVariance: '>= 45',
    spotlightContrast: `>= ${MIN_SPOTLIGHT_CONTRAST} for both per-lamp local samples`,
    spotlightFalloff: `>= ${MIN_SPOTLIGHT_FALLOFF} garment core/edge for both lamps`,
    fps: '>= 45 over 1200ms when hardwarePerformanceEligible',
    blankPageFps: '>= 55',
  },
  fixture: {
    deviceIds: devices.map(device => device.id),
    expectedDeviceIds: EXPECTED_REAL_DEVICE_IDS,
  },
  textureContract: {
    materialSourcePath,
    requiredTextureFiles: REQUIRED_TEXTURE_FILES,
    declaredTextureFiles,
    textureSpecsMatch,
    probes: textureProbes,
    summary: checkResult.textureSummary,
  },
  primaryBlocker,
  fatalError,
  failedChecks: checkResult.failedChecks,
  checks: checkResult.checks,
  results,
}

await writeFile(
  path.join(outputDir, 'three-boutique-qa.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify(report, null, 2))
if (!report.pass) process.exitCode = 1
