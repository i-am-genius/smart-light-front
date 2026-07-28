export const EXPECTED_REAL_DEVICE_IDS = ['101', '102']
export const MIN_SPOTLIGHT_CONTRAST = 1.3
export const MIN_SPOTLIGHT_FALLOFF = 1.06

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return []
  return ids.map(value => String(value)).sort()
}

function hasExpectedRealDeviceIds(ids) {
  const normalized = normalizeIds(ids)
  return new Set(normalized).size === EXPECTED_REAL_DEVICE_IDS.length
    && sameValues(normalized, EXPECTED_REAL_DEVICE_IDS)
}

export function parseSlotCountLabel(text) {
  const match = String(text || '').match(/^\s*(\d+)\s*个灯位\s*$/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isSafeInteger(value) ? value : null
}

export function isTextureWarning(text) {
  return /\[three-boutique\][^\n]*texture[^\n]*failed/i.test(String(text || ''))
}

export function summarizeTextureProbes(probes, requiredTextureFiles) {
  const entries = Array.isArray(probes) ? probes : []
  const required = Array.isArray(requiredTextureFiles) ? requiredTextureFiles : []
  const requiredUnique = new Set(required)
  const counts = new Map()
  for (const probe of entries) {
    const filename = String(probe?.filename || '')
    counts.set(filename, (counts.get(filename) || 0) + 1)
  }

  const missingAssets = required.map(filename => {
    const matches = entries.filter(probe => probe?.filename === filename)
    const probe = matches[0]
    return {
      filename,
      probeCount: matches.length,
      fileExists: probe?.fileExists === true,
      httpStatus: probe?.http?.status ?? null,
      contentType: probe?.http?.contentType || '',
      imageResponse: probe?.http?.imageResponse === true,
      error: probe?.http?.error || '',
    }
  }).filter(asset =>
    asset.probeCount !== 1
    || !asset.fileExists
    || !asset.imageResponse
    || asset.error !== ''
    || !Number.isInteger(asset.httpStatus)
    || asset.httpStatus < 200
    || asset.httpStatus >= 300
    || !/^image\//i.test(asset.contentType),
  )

  const unexpectedAssets = entries
    .filter(probe => !requiredUnique.has(probe?.filename))
    .map(probe => String(probe?.filename || ''))
  const coverageValid = required.length > 0
    && requiredUnique.size === required.length
    && entries.length === required.length
    && unexpectedAssets.length === 0
    && [...counts.values()].every(count => count === 1)
    && required.every(filename => counts.get(filename) === 1)

  return {
    complete: coverageValid && missingAssets.length === 0,
    coverageValid,
    expectedCount: required.length,
    actualCount: entries.length,
    missingAssets,
    unexpectedAssets,
  }
}

export function classifyPerformanceEnvironment({ renderer, blankPageFps, visibilityState }) {
  const rendererText = String(renderer || '').trim()
  const softwareRenderer = /swiftshader|llvmpipe|software|\bwarp\b|microsoft basic render driver|softpipe|lavapipe/i.test(rendererText)
  const rendererKnown = rendererText.length > 0
  const hardwareRenderer = !softwareRenderer
    && /nvidia|\bamd\b|radeon|advanced micro devices|intel|apple/i.test(rendererText)
  const visible = visibilityState === 'visible'
  const baselineAdequate = Number.isFinite(blankPageFps) && blankPageFps >= 55
  const reasons = []
  if (!rendererKnown) reasons.push('renderer-unavailable')
  if (softwareRenderer) reasons.push('software-renderer')
  if (rendererKnown && !softwareRenderer && !hardwareRenderer) {
    reasons.push('hardware-renderer-unconfirmed')
  }
  if (!visible) reasons.push('page-not-visible')
  if (!baselineAdequate) reasons.push('blank-page-raf-below-55')

  return {
    performanceEligible: hardwareRenderer && visible && baselineAdequate,
    renderer: rendererText,
    softwareRenderer,
    hardwareRenderer,
    visibilityState,
    blankPageFps,
    reasons,
  }
}

export function summarizeRafTimestamps(timestamps) {
  const values = Array.isArray(timestamps)
    ? timestamps.map(Number).filter(Number.isFinite)
    : []
  if (values.length < 2) {
    return { durationMs: 0, frameCount: 0, fps: 0, frameTimes: [] }
  }

  const frameTimes = []
  for (let index = 1; index < values.length; index += 1) {
    const interval = values[index] - values[index - 1]
    if (interval > 0) frameTimes.push(interval)
  }
  const durationMs = values[values.length - 1] - values[0]
  const frameCount = frameTimes.length
  const fps = durationMs > 0 ? frameCount / (durationMs / 1000) : 0
  return { durationMs, frameCount, fps, frameTimes }
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function srgbToLinear(value) {
  const channel = value / 255
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

function pixelValues(data, offset) {
  const red = data[offset]
  const green = data[offset + 1]
  const blue = data[offset + 2]
  const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722
  const linearLuma = srgbToLinear(red) * 0.2126
    + srgbToLinear(green) * 0.7152
    + srgbToLinear(blue) * 0.0722
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const chroma = maximum === 0 ? 0 : (maximum - minimum) / maximum
  return { red, green, blue, luma, linearLuma, chroma }
}

function largestConnectedComponent(candidates, gridWidth) {
  const remaining = new Map(candidates.map(point => [point.index, point]))
  let largest = []
  while (remaining.size > 0) {
    const start = remaining.values().next().value
    const queue = [start]
    const component = []
    remaining.delete(start.index)
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const point = queue[cursor]
      component.push(point)
      for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
        for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
          if (xOffset === 0 && yOffset === 0) continue
          const neighbourIndex = point.index + yOffset * gridWidth + xOffset
          const neighbour = remaining.get(neighbourIndex)
          if (!neighbour) continue
          if (Math.abs(neighbour.gridX - point.gridX) > 1) continue
          remaining.delete(neighbourIndex)
          queue.push(neighbour)
        }
      }
    }
    if (component.length > largest.length) largest = component
  }
  return largest
}

function invalidPixelResult(reason, canvasEntropy = 0, canvasVariance = 0) {
  return {
    canvasEntropy,
    canvasVariance,
    spotlightContrast: null,
    spotlightFalloff: null,
    samplingValid: false,
    perLamp: [
      { lamp: 'red', valid: false, score: null, falloffScore: null, reason },
      { lamp: 'green', valid: false, score: null, falloffScore: null, reason },
    ],
    sampling: {
      method: 'per-lamp coloured garment local contrast plus garment core-to-edge falloff',
      reason,
    },
  }
}

export function analyzeBoutiquePixels(data, info) {
  const width = Number(info?.width)
  const height = Number(info?.height)
  const channels = Number(info?.channels)
  if (!data || !Number.isInteger(width) || width <= 0
    || !Number.isInteger(height) || height <= 0
    || !Number.isInteger(channels) || channels < 3
    || data.length < width * height * channels) {
    return invalidPixelResult('invalid-image-data')
  }

  const stride = Math.max(1, Math.floor(Math.min(width, height) / 240))
  const gridWidth = Math.ceil(width / stride)
  const histogram = new Uint32Array(256)
  const canvasLuma = []
  const lampDefinitions = [
    {
      lamp: 'red',
      inHorizontalHalf: x => x < width * 0.5,
      isGarment: pixel => pixel.red > pixel.green * 1.08
        && pixel.red > pixel.blue * 1.08
        && pixel.chroma >= 0.08
        && pixel.luma >= 70,
    },
    {
      lamp: 'green',
      inHorizontalHalf: x => x >= width * 0.5,
      isGarment: pixel => pixel.green > pixel.red * 1.015
        && pixel.green > pixel.blue * 1.06
        && pixel.chroma >= 0.06
        && pixel.luma >= 70,
    },
  ]
  const candidates = new Map(lampDefinitions.map(definition => [definition.lamp, []]))

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * channels
      const pixel = pixelValues(data, offset)
      const roundedLuma = Math.max(0, Math.min(255, Math.round(pixel.luma)))
      histogram[roundedLuma] += 1
      canvasLuma.push(pixel.luma)

      if (y < height * 0.30 || y >= height * 0.72) continue
      for (const definition of lampDefinitions) {
        if (!definition.inHorizontalHalf(x) || !definition.isGarment(pixel)) continue
        const gridX = Math.floor(x / stride)
        const gridY = Math.floor(y / stride)
        candidates.get(definition.lamp).push({
          index: gridY * gridWidth + gridX,
          gridX,
          gridY,
          x,
          y,
          linearLuma: pixel.linearLuma,
        })
      }
    }
  }

  const mean = canvasLuma.reduce((sum, value) => sum + value, 0) / canvasLuma.length
  const canvasVariance = canvasLuma.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / canvasLuma.length
  const canvasEntropy = [...histogram].reduce((entropy, count) => {
    if (count === 0) return entropy
    const probability = count / canvasLuma.length
    return entropy - probability * Math.log2(probability)
  }, 0)

  const minimumGarmentSamples = 24
  const minimumNeutralSamples = 24
  const minimumProfileSamples = 12
  const perLamp = lampDefinitions.map((definition) => {
    const lampCandidates = candidates.get(definition.lamp)
    const candidateLumaThreshold = definition.lamp === 'red'
      ? percentile(lampCandidates.map(point => point.linearLuma), 0.82)
      : null
    const garmentCandidates = candidateLumaThreshold === null
      ? lampCandidates
      : lampCandidates.filter(point => point.linearLuma >= candidateLumaThreshold)
    const component = largestConnectedComponent(garmentCandidates, gridWidth)
    if (component.length < minimumGarmentSamples) {
      return {
        lamp: definition.lamp,
        valid: false,
        score: null,
        falloffScore: null,
        reason: 'insufficient-garment-samples',
        garmentSampleCount: component.length,
        neutralSampleCount: 0,
      }
    }

    const bounds = component.reduce((value, point) => ({
      x0: Math.min(value.x0, point.x),
      y0: Math.min(value.y0, point.y),
      x1: Math.max(value.x1, point.x),
      y1: Math.max(value.y1, point.y),
    }), { x0: width, y0: height, x1: 0, y1: 0 })
    const componentWidth = Math.max(stride, bounds.x1 - bounds.x0 + stride)
    const componentHeight = Math.max(stride, bounds.y1 - bounds.y0 + stride)
    const centerX = (bounds.x0 + bounds.x1) / 2
    const centerY = (bounds.y0 + bounds.y1) / 2
    const halfWidth = Math.max(stride, (bounds.x1 - bounds.x0) / 2)
    const halfHeight = Math.max(stride, (bounds.y1 - bounds.y0) / 2)
    const coreLuma = []
    const edgeLuma = []
    for (const point of component) {
      const radius = Math.hypot(
        (point.x - centerX) / halfWidth,
        (point.y - centerY) / halfHeight,
      )
      if (radius <= 0.42) coreLuma.push(point.linearLuma)
      if (radius >= 0.72) edgeLuma.push(point.linearLuma)
    }
    const halfX0 = definition.lamp === 'red' ? 0 : Math.floor(width * 0.5)
    const halfX1 = definition.lamp === 'red' ? Math.ceil(width * 0.5) : width
    const ring = {
      x0: Math.max(halfX0, Math.floor(bounds.x0 - Math.max(8, componentWidth * 0.8))),
      y0: Math.max(0, Math.floor(bounds.y0 - Math.max(8, componentHeight * 0.55))),
      x1: Math.min(halfX1, Math.ceil(bounds.x1 + Math.max(8, componentWidth * 0.8))),
      y1: Math.min(height, Math.ceil(bounds.y1 + Math.max(8, componentHeight * 0.55))),
    }
    const neutralLuma = []
    for (let y = ring.y0; y < ring.y1; y += stride) {
      for (let x = ring.x0; x < ring.x1; x += stride) {
        if (x >= bounds.x0 - stride && x <= bounds.x1 + stride
          && y >= bounds.y0 - stride && y <= bounds.y1 + stride) continue
        const pixel = pixelValues(data, (y * width + x) * channels)
        if (pixel.chroma <= 0.11) neutralLuma.push(pixel.linearLuma)
      }
    }

    const garmentLuma = percentile(component.map(point => point.linearLuma), 0.9)
    const denominator = percentile(neutralLuma, 0.5)
    const localSamplesValid = component.length >= minimumGarmentSamples
      && neutralLuma.length >= minimumNeutralSamples
      && Number.isFinite(garmentLuma)
      && Number.isFinite(denominator)
      && denominator > 0.005
    const coreMedian = percentile(coreLuma, 0.5)
    const edgeMedian = percentile(edgeLuma, 0.5)
    const profileSamplesValid = coreLuma.length >= minimumProfileSamples
      && edgeLuma.length >= minimumProfileSamples
      && Number.isFinite(coreMedian)
      && Number.isFinite(edgeMedian)
      && edgeMedian > 0.005
    const score = localSamplesValid ? garmentLuma / denominator : null
    const falloffScore = profileSamplesValid ? coreMedian / edgeMedian : null
    const valid = localSamplesValid
      && profileSamplesValid
      && Number.isFinite(score)
      && score > 0
      && Number.isFinite(falloffScore)
      && falloffScore > 0

    return {
      lamp: definition.lamp,
      valid,
      score: valid ? score : null,
      falloffScore: valid ? falloffScore : null,
      reason: valid
        ? ''
        : localSamplesValid ? 'invalid-garment-profile' : 'invalid-local-neutral-ring',
      garmentSampleCount: component.length,
      neutralSampleCount: neutralLuma.length,
      coreSampleCount: coreLuma.length,
      edgeSampleCount: edgeLuma.length,
      candidateLumaThreshold,
      garmentLuma,
      neutralLuma: denominator,
      coreLuma: coreMedian,
      edgeLuma: edgeMedian,
      bounds,
      neutralRing: ring,
    }
  })
  const samplingValid = perLamp.length === 2 && perLamp.every(lamp => lamp.valid)
  const spotlightContrast = samplingValid
    ? Math.min(...perLamp.map(lamp => lamp.score))
    : null
  const spotlightFalloff = samplingValid
    ? Math.min(...perLamp.map(lamp => lamp.falloffScore))
    : null

  return {
    canvasEntropy,
    canvasVariance,
    spotlightContrast,
    spotlightFalloff,
    samplingValid,
    perLamp,
    sampling: {
      method: 'per-lamp coloured garment local contrast plus garment core-to-edge falloff',
      minimumGarmentSamples,
      minimumNeutralSamples,
      minimumProfileSamples,
      coreRadius: '<= 0.42 normalized garment bounds',
      edgeRadius: '>= 0.72 normalized garment bounds',
    },
  }
}

function diagnosticsAreEmpty(results, key) {
  return results.length > 0 && results.every(result =>
    result?.diagnostics
    && Array.isArray(result.diagnostics[key])
    && result.diagnostics[key].length === 0,
  )
}

function validInteractionResult(interaction) {
  return interaction
    && interaction.pass === true
    && interaction.initialSlotCount === 2
    && hasExpectedRealDeviceIds(interaction.initialRealDeviceIds)
    && interaction.initialManualSlotCount === 0
    && Array.isArray(interaction.manufacturedSlotIds)
    && interaction.manufacturedSlotIds.length === 0
    && interaction.selection?.selected === true
    && interaction.realSelectionProtected === true
    && interaction.viewModes?.adjustPressed === true
    && interaction.viewModes?.displayPressed === true
    && interaction.afterAddSlotCount === 3
    && interaction.manualSlotsAfterAdd === 1
    && hasExpectedRealDeviceIds(interaction.realDeviceIdsAfterAdd)
    && interaction.afterDeleteSlotCount === 2
    && hasExpectedRealDeviceIds(interaction.finalRealDeviceIds)
    && interaction.finalManualSlotCount === 0
    && interaction.realDeviceIdsPreserved === true
}

export function buildChecks(input) {
  const results = Array.isArray(input?.results) ? input.results : []
  const expectedViewportCount = Number(input?.expectedViewportCount) || 0
  const textureSummary = summarizeTextureProbes(
    input?.textureProbes,
    input?.requiredTextureFiles,
  )
  const interactionResults = results
    .map(result => result?.interactions)
    .filter(Boolean)
  const resultCountValid = expectedViewportCount > 0 && results.length === expectedViewportCount

  const checks = {
    noFatalError: !input?.fatalError,
    bothViewportsCompleted: resultCountValid && results.every(result => !result?.error),
    fixtureIdsValid: hasExpectedRealDeviceIds(input?.fixtureDeviceIds),
    diagnosticsPresent: resultCountValid && results.every(result => result?.diagnostics),
    exactTwoRealSlots: resultCountValid && results.every(result =>
      result?.initialSlotCount === 2
      && hasExpectedRealDeviceIds(result?.initialRealDeviceIds),
    ),
    noManualGhosts: resultCountValid && results.every(result =>
      result?.initialManualSlotCount === 0
      && (!result?.interactions || result.interactions.finalManualSlotCount === 0),
    ),
    noManufacturedPlaceholders: resultCountValid && results.every(result =>
      Array.isArray(result?.manufacturedSlotIds)
      && result.manufacturedSlotIds.length === 0,
    ),
    canvasNonblank: resultCountValid && results.every(result =>
      Number.isFinite(result?.pixels?.canvasEntropy)
      && result.pixels.canvasEntropy > 1,
    ),
    canvasVariance: resultCountValid && results.every(result =>
      Number.isFinite(result?.pixels?.canvasVariance)
      && result.pixels.canvasVariance >= 45,
    ),
    spotlightContrast: resultCountValid && results.every(result =>
      result?.pixels?.samplingValid === true
      && Array.isArray(result.pixels.perLamp)
      && result.pixels.perLamp.length === 2
      && result.pixels.perLamp.every(lamp => lamp.valid === true)
      && Number.isFinite(result.pixels.spotlightContrast)
      && result.pixels.spotlightContrast >= MIN_SPOTLIGHT_CONTRAST,
    ),
    spotlightFalloff: resultCountValid && results.every(result =>
      result?.pixels?.samplingValid === true
      && Array.isArray(result.pixels.perLamp)
      && result.pixels.perLamp.length === 2
      && result.pixels.perLamp.every(lamp =>
        lamp.valid === true
        && Number.isFinite(lamp.falloffScore)
        && lamp.falloffScore >= MIN_SPOTLIGHT_FALLOFF,
      )
      && Number.isFinite(result.pixels.spotlightFalloff)
      && result.pixels.spotlightFalloff >= MIN_SPOTLIGHT_FALLOFF,
    ),
    hardwarePerformanceEligible: resultCountValid && results.every(result =>
      result?.performance?.environment?.performanceEligible === true,
    ),
    fpsThreshold: resultCountValid && results.every(result =>
      result?.performance?.environment?.performanceEligible !== true
      || (Number.isFinite(result?.performance?.fps) && result.performance.fps >= 45),
    ),
    rendererInfoCaptured: resultCountValid && results.every(result =>
      result?.performance?.rendererInfo?.instrumentationPatched === true
      && Number.isFinite(result.performance.rendererInfo.calls)
      && result.performance.rendererInfo.calls > 0
      && Number.isFinite(result.performance.rendererInfo.triangles)
      && result.performance.rendererInfo.triangles > 0,
    ),
    interactions: interactionResults.length === 1
      && interactionResults.every(validInteractionResult),
    consoleErrors: diagnosticsAreEmpty(results, 'consoleErrors'),
    pageErrors: diagnosticsAreEmpty(results, 'pageErrors'),
    requestFailures: diagnosticsAreEmpty(results, 'requestFailures'),
    httpErrors: diagnosticsAreEmpty(results, 'httpErrors'),
    texture404s: diagnosticsAreEmpty(results, 'texture404s'),
    textureWarnings: diagnosticsAreEmpty(results, 'textureWarnings'),
    textureProbeCoverage: textureSummary.coverageValid,
    textureSpecsMatch: input?.textureSpecsMatch === true,
    textureAssetsPresent: textureSummary.complete,
  }
  const failedChecks = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([name]) => name)

  return {
    pass: failedChecks.length === 0,
    checks,
    failedChecks,
    textureSummary,
  }
}
