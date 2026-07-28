import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  analyzeBoutiquePixels,
  buildChecks,
  classifyPerformanceEnvironment,
  isTextureWarning,
  parseSlotCountLabel,
  summarizeRafTimestamps,
  summarizeTextureProbes,
} from '../scripts/qa/threeBoutiqueQaMetrics.mjs'

const REQUIRED_TEXTURE_FILES = [
  'smoked-oak-color.png',
  'smoked-oak-height.png',
  'mineral-plaster-color.png',
  'mineral-plaster-height.png',
  'woven-fabric-height.png',
  'brushed-metal-roughness.png',
]

function diagnostics() {
  return {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    texture404s: [],
    textureWarnings: [],
  }
}

function textureProbes() {
  return REQUIRED_TEXTURE_FILES.map(filename => ({
    filename,
    fileExists: true,
    http: { status: 200, contentType: 'image/png', imageResponse: true, error: '' },
  }))
}

function interactions() {
  return {
    pass: true,
    initialSlotCount: 2,
    initialRealDeviceIds: ['101', '102'],
    initialManualSlotCount: 0,
    manufacturedSlotIds: [],
    selection: { selected: true },
    realSelectionProtected: true,
    viewModes: { adjustPressed: true, displayPressed: true },
    afterAddSlotCount: 3,
    manualSlotsAfterAdd: 1,
    realDeviceIdsAfterAdd: ['101', '102'],
    afterDeleteSlotCount: 2,
    finalRealDeviceIds: ['101', '102'],
    finalManualSlotCount: 0,
    realDeviceIdsPreserved: true,
  }
}

function viewportResult(withInteractions = false) {
  return {
    initialSlotCount: 2,
    initialSlotIds: ['device-101', 'device-102'],
    initialRealDeviceIds: ['101', '102'],
    initialManualSlotCount: 0,
    manufacturedSlotIds: [],
    pixels: {
      canvasEntropy: 5,
      canvasVariance: 120,
      spotlightContrast: 2.1,
      spotlightFalloff: 1.12,
      samplingValid: true,
      perLamp: [
        { lamp: 'red', score: 2.2, falloffScore: 1.14, valid: true },
        { lamp: 'green', score: 2.1, falloffScore: 1.12, valid: true },
      ],
    },
    performance: {
      fps: 60,
      frameCount: 72,
      environment: { performanceEligible: true },
      rendererInfo: {
        instrumentationPatched: true,
        calls: 80,
        triangles: 12000,
        textures: 8,
      },
    },
    interactions: withInteractions ? interactions() : null,
    diagnostics: diagnostics(),
  }
}

function validInput() {
  return {
    fixtureDeviceIds: [101, 102],
    expectedViewportCount: 2,
    requiredTextureFiles: REQUIRED_TEXTURE_FILES,
    textureProbes: textureProbes(),
    textureSpecsMatch: true,
    fatalError: null,
    results: [viewportResult(true), viewportResult(false)],
  }
}

function clone(value) {
  return structuredClone(value)
}

function syntheticScene(horizontalPadding = 0, background = [105, 105, 105]) {
  const contentWidth = 120
  const width = contentWidth + horizontalPadding * 2
  const height = 90
  const channels = 3
  const data = new Uint8Array(width * height * channels)
  for (let offset = 0; offset < data.length; offset += channels) {
    data[offset] = background[0]
    data[offset + 1] = background[1]
    data[offset + 2] = background[2]
  }
  const fill = (x0, y0, x1, y1, colour) => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0 + horizontalPadding; x < x1 + horizontalPadding; x += 1) {
        const offset = (y * width + x) * channels
        data[offset] = colour[0]
        data[offset + 1] = colour[1]
        data[offset + 2] = colour[2]
      }
    }
  }
  fill(20, 38, 38, 66, [245, 120, 110])
  fill(80, 38, 98, 66, [105, 180, 95])
  return { data, info: { width, height, channels } }
}

function addWarmFloor(scene, horizontalPadding = 0) {
  const { data, info } = scene
  for (let y = 58; y < 70; y += 1) {
    for (let x = horizontalPadding; x < info.width - horizontalPadding; x += 1) {
      const offset = (y * info.width + x) * info.channels
      data[offset] = 190
      data[offset + 1] = 125
      data[offset + 2] = 90
    }
  }
}

function addOverexposedCove(scene) {
  const { data, info } = scene
  for (let y = 27; y < 34; y += 1) {
    for (let x = 8; x < info.width - 8; x += 1) {
      const offset = (y * info.width + x) * info.channels
      data[offset] = 255
      data[offset + 1] = 248
      data[offset + 2] = 232
    }
  }
}

function addSyntheticSpotFalloff(scene, horizontalPadding = 0) {
  const { data, info } = scene
  const paint = (x0, y0, x1, y1, edge, core) => {
    const centerX = (x0 + x1 - 1) / 2
    const centerY = (y0 + y1 - 1) / 2
    const halfWidth = (x1 - x0) / 2
    const halfHeight = (y1 - y0) / 2
    for (let y = y0; y < y1; y += 1) {
      for (let localX = x0; localX < x1; localX += 1) {
        const radius = Math.min(1, Math.hypot(
          (localX - centerX) / halfWidth,
          (y - centerY) / halfHeight,
        ))
        const strength = 1 - radius
        const x = localX + horizontalPadding
        const offset = (y * info.width + x) * info.channels
        for (let channel = 0; channel < 3; channel += 1) {
          data[offset + channel] = Math.round(
            edge[channel] + (core[channel] - edge[channel]) * strength,
          )
        }
      }
    }
  }
  paint(20, 38, 38, 66, [190, 88, 82], [250, 150, 135])
  paint(80, 38, 98, 66, [78, 138, 72], [145, 220, 130])
}

describe('three boutique QA metrics', () => {
  it('accepts a complete hardware-backed fixture', () => {
    const result = buildChecks(validInput())

    assert.equal(result.pass, true)
    assert.deepEqual(result.failedChecks, [])
    assert.ok(Object.values(result.checks).every(Boolean))
  })

  it('fails every browser diagnostic gate independently', () => {
    const cases = [
      ['consoleErrors', 'consoleErrors', 'error'],
      ['pageErrors', 'pageErrors', 'error'],
      ['requestFailures', 'requestFailures', { url: '/failed' }],
      ['httpErrors', 'httpErrors', { url: '/500', status: 500 }],
      ['texture404s', 'texture404s', { url: '/texture.png', status: 404 }],
      ['textureWarnings', 'textureWarnings', '[three-boutique] texture loading failed'],
    ]

    for (const [diagnosticKey, checkKey, value] of cases) {
      const input = validInput()
      input.results[1].diagnostics[diagnosticKey].push(value)
      const result = buildChecks(input)
      assert.equal(result.checks[checkKey], false, String(diagnosticKey))
      assert.equal(result.pass, false, String(diagnosticKey))
    }
  })

  it('requires exactly one successful probe for all six texture specs', () => {
    const probes = textureProbes()
    assert.equal(summarizeTextureProbes([], REQUIRED_TEXTURE_FILES).complete, false)
    assert.equal(summarizeTextureProbes(probes.slice(0, 5), REQUIRED_TEXTURE_FILES).complete, false)
    assert.equal(summarizeTextureProbes([...probes, probes[0]], REQUIRED_TEXTURE_FILES).complete, false)

    const duplicate = probes.slice()
    duplicate[5] = { ...duplicate[0] }
    assert.equal(summarizeTextureProbes(duplicate, REQUIRED_TEXTURE_FILES).complete, false)
    assert.equal(summarizeTextureProbes(probes, REQUIRED_TEXTURE_FILES).complete, true)

    const input = validInput()
    input.textureProbes = []
    assert.equal(buildChecks(input).checks.textureAssetsPresent, false)
  })

  it('does not trust imageResponse when the texture probe response is invalid', () => {
    const withError = textureProbes()
    withError[0].http.error = 'decode failed'
    assert.equal(summarizeTextureProbes(withError, REQUIRED_TEXTURE_FILES).complete, false)

    const badStatus = textureProbes()
    badStatus[0].http.status = 500
    assert.equal(summarizeTextureProbes(badStatus, REQUIRED_TEXTURE_FILES).complete, false)

    const badContentType = textureProbes()
    badContentType[0].http.contentType = 'text/html'
    assert.equal(summarizeTextureProbes(badContentType, REQUIRED_TEXTURE_FILES).complete, false)
  })

  it('requires fixture and runtime real IDs to be distinct 101 and 102 with no manual ghosts', () => {
    const duplicateFixture = validInput()
    duplicateFixture.fixtureDeviceIds = [101, 101]
    assert.equal(buildChecks(duplicateFixture).checks.fixtureIdsValid, false)

    const wrongFixture = validInput()
    wrongFixture.fixtureDeviceIds = [101, 103]
    assert.equal(buildChecks(wrongFixture).checks.fixtureIdsValid, false)

    const duplicateRuntime = validInput()
    duplicateRuntime.results[0].initialRealDeviceIds = ['101', '101']
    assert.equal(buildChecks(duplicateRuntime).checks.exactTwoRealSlots, false)

    const initialGhost = validInput()
    initialGhost.results[1].initialManualSlotCount = 1
    assert.equal(buildChecks(initialGhost).checks.noManualGhosts, false)

    const finalGhost = validInput()
    finalGhost.results[0].interactions.finalManualSlotCount = 1
    assert.equal(buildChecks(finalGhost).checks.interactions, false)
  })

  it('rejects invalid ROI metrics and empty renderer instrumentation', () => {
    const invalidRoi = validInput()
    invalidRoi.results[0].pixels.samplingValid = false
    invalidRoi.results[0].pixels.spotlightContrast = null
    assert.equal(buildChecks(invalidRoi).checks.spotlightContrast, false)

    const zeroCalls = validInput()
    zeroCalls.results[0].performance.rendererInfo.calls = 0
    assert.equal(buildChecks(zeroCalls).checks.rendererInfoCaptured, false)

    const zeroTriangles = validInput()
    zeroTriangles.results[0].performance.rendererInfo.triangles = 0
    assert.equal(buildChecks(zeroTriangles).checks.rendererInfoCaptured, false)
  })

  it('requires a passing interaction result and exact real IDs after manual add', () => {
    const explicitFailure = validInput()
    explicitFailure.results[0].interactions.pass = false
    assert.equal(buildChecks(explicitFailure).checks.interactions, false)

    const duplicateAfterAdd = validInput()
    duplicateAfterAdd.results[0].interactions.realDeviceIdsAfterAdd = ['101', '101']
    assert.equal(buildChecks(duplicateAfterAdd).checks.interactions, false)
  })

  it('classifies software or slow blank-page renderers as performance-ineligible', () => {
    for (const renderer of [
      'ANGLE SwiftShader',
      'Mesa llvmpipe',
      'Software Rasterizer',
      'Microsoft Basic Render Driver',
      'ANGLE (WARP Direct3D11)',
      'Mesa softpipe',
      'Mesa lavapipe',
    ]) {
      const result = classifyPerformanceEnvironment({
        renderer,
        blankPageFps: 60,
        visibilityState: 'visible',
      })
      assert.equal(result.performanceEligible, false, renderer)
    }

    assert.equal(classifyPerformanceEnvironment({
      renderer: 'ANGLE (NVIDIA RTX 4060 Direct3D11)',
      blankPageFps: 54.9,
      visibilityState: 'visible',
    }).performanceEligible, false)
    assert.equal(classifyPerformanceEnvironment({
      renderer: 'ANGLE (NVIDIA RTX 4060 Direct3D11)',
      blankPageFps: 60,
      visibilityState: 'visible',
    }).performanceEligible, true)
    const unknown = classifyPerformanceEnvironment({
      renderer: 'WebKit WebGL',
      blankPageFps: 60,
      visibilityState: 'visible',
    })
    assert.equal(unknown.performanceEligible, false)
    assert.ok(unknown.reasons.includes('hardware-renderer-unconfirmed'))
  })

  it('does not treat graphics API names as hardware renderer identities', () => {
    for (const renderer of [
      'ANGLE (Unknown GPU Direct3D11)',
      'ANGLE (Unknown GPU Metal Renderer)',
    ]) {
      const result = classifyPerformanceEnvironment({
        renderer,
        blankPageFps: 60,
        visibilityState: 'visible',
      })

      assert.equal(result.performanceEligible, false, renderer)
      assert.equal(result.hardwareRenderer, false, renderer)
      assert.ok(result.reasons.includes('hardware-renderer-unconfirmed'), renderer)
    }
  })

  it('uses the first rAF timestamp only as the baseline', () => {
    const timing = summarizeRafTimestamps([-5, 11.7, 28.4, 45.1])

    assert.equal(timing.frameCount, 3)
    assert.equal(timing.frameTimes.length, 3)
    assert.ok(timing.frameTimes.every(interval => interval > 0))
    assert.ok(timing.fps >= 59 && timing.fps <= 61)
  })

  it('reports software performance eligibility without blaming the scene FPS threshold', () => {
    const input = validInput()
    for (const result of input.results) {
      result.performance.fps = 2
      result.performance.environment = {
        performanceEligible: false,
        renderer: 'ANGLE SwiftShader',
      }
    }

    const checks = buildChecks(input)
    assert.equal(checks.checks.hardwarePerformanceEligible, false)
    assert.equal(checks.checks.fpsThreshold, true)
    assert.ok(checks.failedChecks.includes('hardwarePerformanceEligible'))
    assert.ok(!checks.failedChecks.includes('fpsThreshold'))
  })

  it('parses an exact slot-count label instead of substring-matching 12 as 2', () => {
    assert.equal(parseSlotCountLabel('2 个灯位'), 2)
    assert.equal(parseSlotCountLabel('12 个灯位'), 12)
    assert.equal(parseSlotCountLabel('共 2 个灯位'), null)
    assert.equal(parseSlotCountLabel('2 个灯位 extra'), null)
  })

  it('recognizes every boutique texture failure warning form', () => {
    assert.equal(isTextureWarning('[three-boutique] texture failed: smokedOakColor'), true)
    assert.equal(isTextureWarning('[three-boutique] boutique texture loading failed: map'), true)
    assert.equal(isTextureWarning('[three-boutique] material fallback enabled'), false)
    assert.equal(isTextureWarning('texture failed outside boutique'), false)
  })

  it('scores the red and green lamps independently and uses the weaker score', () => {
    const scene = syntheticScene()
    const result = analyzeBoutiquePixels(scene.data, scene.info)

    assert.equal(result.samplingValid, true)
    assert.equal(result.perLamp.length, 2)
    assert.ok(result.perLamp.every(lamp => lamp.valid))
    assert.notEqual(result.perLamp[0].score, result.perLamp[1].score)
    assert.equal(result.spotlightContrast, Math.min(...result.perLamp.map(lamp => lamp.score)))
  })

  it('does not mistake a broad warm floor for the red garment', () => {
    const scene = syntheticScene()
    addWarmFloor(scene)
    const result = analyzeBoutiquePixels(scene.data, scene.info)
    const red = result.perLamp.find(lamp => lamp.lamp === 'red')

    assert.equal(red.valid, true)
    assert.ok(red.bounds.x1 - red.bounds.x0 < scene.info.width * 0.3)
    assert.ok(red.bounds.y0 < 55)
  })

  it('rejects flat garment blocks even when a blown cove makes the old contrast score pass', () => {
    const scene = syntheticScene(0, [55, 55, 55])
    addOverexposedCove(scene)
    const pixels = analyzeBoutiquePixels(scene.data, scene.info)
    const input = validInput()
    for (const result of input.results) result.pixels = pixels

    assert.equal(pixels.samplingValid, true, JSON.stringify(pixels.perLamp))
    assert.ok(pixels.spotlightContrast >= 1.8)
    assert.equal(pixels.spotlightFalloff, 1)
    const result = buildChecks(input)
    assert.equal(result.checks.spotlightContrast, true)
    assert.equal(result.checks.spotlightFalloff, false)
    assert.equal(result.pass, false)
  })

  it('detects radial brightness falloff inside both garment components', () => {
    const scene = syntheticScene()
    addSyntheticSpotFalloff(scene)
    const pixels = analyzeBoutiquePixels(scene.data, scene.info)

    assert.equal(pixels.samplingValid, true, JSON.stringify(pixels.perLamp))
    assert.ok(pixels.spotlightFalloff >= 1.06)
    assert.ok(pixels.perLamp.every(lamp => lamp.falloffScore >= 1.06))
  })

  it('rejects empty garment samples and a zero neutral denominator', () => {
    const empty = new Uint8Array(80 * 60 * 3)
    const emptyResult = analyzeBoutiquePixels(empty, { width: 80, height: 60, channels: 3 })
    assert.equal(emptyResult.samplingValid, false)
    assert.equal(emptyResult.spotlightContrast, null)

    const blackRing = syntheticScene(0, [0, 0, 0])
    const blackRingResult = analyzeBoutiquePixels(blackRing.data, blackRing.info)
    assert.equal(blackRingResult.samplingValid, false)
    assert.equal(blackRingResult.spotlightContrast, null)
  })

  it('keeps per-lamp contrast stable when horizontal canvas padding changes', () => {
    const base = syntheticScene(0)
    const padded = syntheticScene(24)
    const baseResult = analyzeBoutiquePixels(base.data, base.info)
    const paddedResult = analyzeBoutiquePixels(padded.data, padded.info)

    assert.equal(baseResult.samplingValid, true)
    assert.equal(paddedResult.samplingValid, true)
    assert.ok(Math.abs(baseResult.spotlightContrast - paddedResult.spotlightContrast) <= 0.03)
    for (let index = 0; index < baseResult.perLamp.length; index += 1) {
      assert.ok(Math.abs(baseResult.perLamp[index].score - paddedResult.perLamp[index].score) <= 0.03)
    }
  })
})
