import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const harnessUrl = new URL('../scripts/qa/threeBoutiqueSceneQa.mjs', import.meta.url)
const metricsUrl = new URL('../scripts/qa/threeBoutiqueQaMetrics.mjs', import.meta.url)

function readHarness() {
  return readFileSync(harnessUrl, 'utf8')
}

function readMetrics() {
  return readFileSync(metricsUrl, 'utf8')
}

describe('three boutique QA harness', () => {
  it('checks both PC viewports and writes the required artifacts', () => {
    const source = readHarness()

    assert.match(source, /width:\s*1920,\s*height:\s*1080/)
    assert.match(source, /width:\s*2560,\s*height:\s*1440/)
    assert.match(source, /three-boutique-\$\{label\}\.png/)
    assert.match(source, /three-boutique-qa\.json/)
    assert.match(source, /THREE_QA_BASE_URL/)
    assert.match(source, /http:\/\/127\.0\.0\.1:5178\/smartlightdashboard/)
  })

  it('measures a nonblank canvas, isolated spotlight contrast, and stable FPS', () => {
    const source = readHarness()
    const metrics = readMetrics()

    assert.match(source, /analyzeBoutiquePixels/)
    assert.match(source, /classifyPerformanceEnvironment/)
    assert.match(source, /summarizeRafTimestamps/)
    assert.match(source, /blankPageBaseline/)
    assert.match(source, /UNMASKED_RENDERER_WEBGL/)
    assert.match(source, /visibilityState/)
    assert.match(source, /canvasSize/)
    assert.match(metrics, /canvasEntropy\s*>\s*1/)
    assert.match(metrics, /canvasVariance\s*>=\s*45/)
    assert.match(metrics, /spotlightContrast\s*>=\s*MIN_SPOTLIGHT_CONTRAST/)
    assert.match(metrics, /spotlightFalloff\s*>=\s*MIN_SPOTLIGHT_FALLOFF/)
    assert.match(metrics, /fps\s*>=\s*45/)
    assert.match(source, /FPS_SAMPLE_MS\s*=\s*1[02]00/)
    assert.match(source, /let started = null/)
    assert.match(source, /if \(started === null\)/)
    assert.match(source, /hideUiOverlaysForSampling/)
    assert.ok(source.indexOf('await measureFps') < source.indexOf('await page.screenshot'))
  })

  it('mocks exactly two real lamps and exercises the protected slot lifecycle', () => {
    const source = readHarness()
    const combined = `${source}\n${readMetrics()}`

    assert.match(source, /const devices = \[/)
    assert.equal((source.match(/chipId:\s*'qa-lamp-[12]'/g) || []).length, 2)
    assert.match(source, /manufacturedSlotIds/)
    assert.match(source, /placeholder-\|mock-fallback/)
    assert.match(source, /initialSlotCount\s*===\s*2/)
    assert.match(source, /realDeviceIdsPreserved/)
    assert.match(source, /getByRole\('button',\s*\{ name: '添加灯位'/)
    assert.match(source, /getByRole\('button',\s*\{ name: '展示'/)
    assert.match(source, /getByRole\('button',\s*\{ name: '调节'/)
    assert.match(combined, /afterAddSlotCount\s*===\s*3/)
    assert.match(combined, /afterDeleteSlotCount\s*===\s*2/)
    assert.match(source, /parseSlotCountLabel/)
    assert.doesNotMatch(source, /\.includes\(`\$\{value\} 个灯位`\)/)
  })

  it('records renderer diagnostics and never hides missing texture assets', () => {
    const source = readHarness()
    const metrics = readMetrics()

    assert.match(source, /rendererInfo/)
    assert.match(source, /calls/)
    assert.match(source, /triangles/)
    assert.match(source, /textures/)
    assert.match(source, /isTextureWarning/)
    assert.match(metrics, /consoleErrors/)
    assert.match(metrics, /pageErrors/)
    assert.match(metrics, /requestFailures/)
    assert.match(metrics, /httpErrors/)
    assert.match(source, /texture404s/)
    assert.match(metrics, /textureWarnings/)
    assert.match(metrics, /missingAssets/)
    assert.match(source, /texture asset missing/)
  })

  it('probes textures once and preserves diagnostics on viewport failures', () => {
    const source = readHarness()

    assert.equal((source.match(/await probeTextureAssets\(/g) || []).length, 1)
    assert.match(source, /const textureProbes = await probeTextureAssets\(/)
    assert.match(source, /error:[\s\S]{0,300}diagnostics/)
    assert.match(source, /buildChecks\(/)
  })
})
