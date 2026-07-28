import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  garmentRgbCss,
  garmentSignature,
  garmentTextColor,
  getDisplayGarments,
  normalizeGarmentState,
} from '../src/utils/garmentRecognition.ts'

const garmentSamples = JSON.parse(readFileSync(
  new URL('./fixtures/garment-recognition-samples.json', import.meta.url),
  'utf8',
))

test('normalizes one upper garment', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    outfitType: 'upper_only',
    garments: [{
      position: 'upper',
      category: 'upper',
      fabric: 'cotton',
      fabricConfidence: 0.91,
      mainColorRgb: '10,20,30',
      maskArea: 300,
    }],
  })

  assert.equal(state.outfitType, 'upper_only')
  assert.deepEqual(state.garments.map(item => item.category), ['upper'])
})

test('keeps only the actual single pants garment', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    outfitType: 'lower_only',
    garments: [{
      position: 'lower',
      category: 'pants',
      fabric: 'cotton',
      fabricConfidence: 0.81,
      mainColorRgb: '10,20,30',
      maskArea: 200,
    }],
  })

  assert.equal(state.outfitType, 'lower_only')
  assert.deepEqual(state.garments.map(item => item.category), ['pants'])
  assert.equal(state.garments.some(item => item.position === 'upper'), false)
})

test('normalizes one skirt garment', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    garments: [{
      position: 'lower',
      category: 'skirt',
      fabric: 'linen',
      mainColorRgb: '80,90,100',
      maskArea: 180,
    }],
  })

  assert.equal(state.outfitType, 'lower_only')
  assert.deepEqual(state.garments.map(item => item.category), ['skirt'])
})

test('normalizes one full-body dress', () => {
  const state = normalizeGarmentState(garmentSamples.structured)

  assert.equal(state.outfitType, 'dress')
  assert.deepEqual(state.garments.map(item => item.category), ['dress'])
})

test('normalizes upper and lower separates', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    outfitType: 'separates',
    garments: [{
      position: 'upper',
      category: 'upper',
      fabric: 'cotton',
      mainColorRgb: '10,20,30',
      maskArea: 220,
    }, {
      position: 'lower',
      category: 'pants',
      fabric: 'denim',
      mainColorRgb: '40,50,60',
      maskArea: 260,
    }],
  })

  assert.equal(state.outfitType, 'separates')
  assert.deepEqual(state.garments.map(item => item.category), ['upper', 'pants'])
})

test('legacy scalar result becomes one upper garment', () => {
  const garments = getDisplayGarments(garmentSamples.legacy)

  assert.deepEqual(garments.map(item => ({
    position: item.position,
    category: item.category,
    fabric: item.fabric,
    mainColorRgb: item.mainColorRgb,
  })), [{
    position: 'upper',
    category: 'upper',
    fabric: 'polyester',
    mainColorRgb: '213,215,217',
  }])
})

test('structured garments do not inherit legacy scalar values', () => {
  const garments = getDisplayGarments({
    resultVersion: 1,
    fabric: 'legacy fabric',
    mainColorRgb: '9,9,9',
    garments: [{
      position: 'lower',
      category: 'pants',
      fabric: '',
      mainColorRgb: '',
      maskArea: 200,
    }],
  })

  assert.equal(garments.length, 1)
  assert.equal(garments[0].fabric, '')
  assert.equal(garments[0].mainColorRgb, '')
})

test('unknown structured version consumes only understood legacy garment fields', () => {
  const state = normalizeGarmentState(garmentSamples.unknownVersion)

  assert.equal(state.resultVersion, 99)
  assert.equal(state.outfitType, 'upper_only')
  assert.equal(state.clothDetected, undefined)
  assert.equal(state.segmentationFallback, undefined)
  assert.deepEqual(state.garments.map(item => ({
    position: item.position,
    category: item.category,
    fabric: item.fabric,
    mainColorRgb: item.mainColorRgb,
  })), [{
    position: 'upper',
    category: 'upper',
    fabric: 'polyester',
    mainColorRgb: '9,8,7',
  }])
})

test('empty legacy values do not invent a garment', () => {
  assert.deepEqual(getDisplayGarments({}), [])
  assert.deepEqual(getDisplayGarments({ fabric: '', mainColorRgb: '' }), [])
})

test('filters invalid positions, categories, and mismatched pairs', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    garments: [{
      position: 'side',
      category: 'upper',
      fabric: 'bad position',
      mainColorRgb: '',
      maskArea: 1,
    }, {
      position: 'upper',
      category: 'shorts',
      fabric: 'bad category',
      mainColorRgb: '',
      maskArea: 1,
    }, {
      position: 'upper',
      category: 'pants',
      fabric: 'bad pair',
      mainColorRgb: '',
      maskArea: 1,
    }],
  })

  assert.deepEqual(state.garments, [])
  assert.equal(state.outfitType, undefined)
})

test('preserves an allowed declared outfit type', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    outfitType: 'dress',
    garments: [{
      position: 'lower',
      category: 'skirt',
      fabric: 'linen',
      mainColorRgb: '1,2,3',
      maskArea: 150,
    }],
  })

  assert.equal(state.outfitType, 'dress')
})

test('preserves an allowed declared outfit type without garments', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    outfitType: 'dress',
    garments: [],
  })

  assert.equal(state.outfitType, 'dress')
  assert.deepEqual(state.garments, [])
})

test('ignores an unknown outfit type and derives from valid garments', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    outfitType: 'coat',
    garments: [{
      position: 'upper',
      category: 'upper',
      fabric: 'cotton',
      mainColorRgb: '1,2,3',
      maskArea: 160,
    }],
  })

  assert.equal(state.outfitType, 'upper_only')
  assert.deepEqual(state.garments.map(item => item.category), ['upper'])
})

test('filters duplicate positions and caps structured output at two garments', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    garments: [{
      position: 'upper',
      category: 'upper',
      fabric: 'first upper',
      mainColorRgb: '',
      maskArea: 100,
    }, {
      position: 'upper',
      category: 'upper',
      fabric: 'duplicate upper',
      mainColorRgb: '',
      maskArea: 90,
    }, {
      position: 'lower',
      category: 'pants',
      fabric: 'lower',
      mainColorRgb: '',
      maskArea: 200,
    }],
  })

  assert.equal(state.garments.length, 2)
  assert.deepEqual(state.garments.map(item => item.fabric), ['first upper', 'lower'])
  assert.equal(state.outfitType, 'separates')
})

test('does not expose an inconsistent upper plus dress combination', () => {
  const state = normalizeGarmentState({
    resultVersion: 1,
    garments: [{
      position: 'upper',
      category: 'upper',
      fabric: 'top',
      mainColorRgb: '',
      maskArea: 100,
    }, {
      position: 'fullBody',
      category: 'dress',
      fabric: 'dress',
      mainColorRgb: '',
      maskArea: 400,
    }],
  })

  assert.equal(state.garments.length, 1)
  assert.equal(state.outfitType, 'upper_only')
})

test('signature changes by category combination but not color', () => {
  const upper = getDisplayGarments({ fabric: 'cotton', mainColorRgb: '1,2,3' })
  const recolored = getDisplayGarments({ fabric: 'cotton', mainColorRgb: '7,8,9' })
  const separates = getDisplayGarments({
    resultVersion: 1,
    garments: [{
      position: 'lower',
      category: 'pants',
      fabric: 'denim',
      mainColorRgb: '7,8,9',
      maskArea: 200,
    }, {
      position: 'upper',
      category: 'upper',
      fabric: 'cotton',
      mainColorRgb: '1,2,3',
      maskArea: 200,
    }],
  })

  assert.equal(garmentSignature(upper), 'upper:upper')
  assert.equal(garmentSignature(upper), garmentSignature(recolored))
  assert.equal(garmentSignature(separates), 'lower:pants|upper:upper')
})

test('formats RGB CSS independently from text contrast', () => {
  assert.equal(garmentRgbCss('10,20,30'), 'rgb(10, 20, 30)')
  assert.equal(garmentRgbCss(undefined, '#888'), '#888')
  assert.equal(garmentRgbCss('invalid', '#eee'), '#eee')
  assert.equal(garmentTextColor('250,250,250'), '#000')
  assert.equal(garmentTextColor('10,20,30'), '#fff')
  assert.equal(garmentTextColor(undefined), '#fff')
})

test('only accepts real booleans for boolean result fields', () => {
  const invalid = normalizeGarmentState({
    clothDetected: 'false',
    segmentationFallback: 1,
  })
  const valid = normalizeGarmentState({
    clothDetected: false,
    segmentationFallback: true,
  })

  assert.equal(invalid.clothDetected, undefined)
  assert.equal(invalid.segmentationFallback, undefined)
  assert.equal(valid.clothDetected, false)
  assert.equal(valid.segmentationFallback, true)
})

test('nullable or blank optional numbers stay absent instead of coercing to zero', () => {
  const [garment] = getDisplayGarments({
    resultVersion: 1,
    garments: [{
      position: 'upper',
      category: 'upper',
      categoryConfidence: null,
      fabric: 'cotton',
      fabricConfidence: '',
      mainColorRgb: '1,2,3',
      maskArea: 100,
      x: null,
      y: undefined,
      w: '',
      h: '   ',
    }],
  })

  assert.equal(garment.categoryConfidence, null)
  assert.equal(garment.fabricConfidence, undefined)
  assert.equal(garment.x, undefined)
  assert.equal(garment.y, undefined)
  assert.equal(garment.w, undefined)
  assert.equal(garment.h, undefined)
})

const dashboardSource = readFileSync(
  new URL('../src/views/SmartLightDashboard.vue', import.meta.url),
  'utf8',
)
const aiApiSource = readFileSync(
  new URL('../src/api/ai.ts', import.meta.url),
  'utf8',
)

test('dashboard routes every lamp AI entry through shared normalization', () => {
  assert.match(
    dashboardSource,
    /import\s*\{[\s\S]*?\bnormalizeGarmentState\b[\s\S]*?\}\s*from\s*['"]\.\.\/utils\/garmentRecognition['"]/,
  )
  assert.match(
    dashboardSource,
    /function normalizeGarmentIncoming[\s\S]{0,500}?hasExplicitGarmentData[\s\S]*?normalizeGarmentState/,
  )
  assert.match(
    dashboardSource,
    /map\.set\(key,\s*\{\s*\.\.\.\(existing \|\| \{\}\),\s*\.\.\.normalizeGarmentIncoming\(device\)\s*\}\)/,
  )
  assert.match(
    dashboardSource,
    /message\.type === 'state'[\s\S]*?updateDeviceByIncoming\(normalizeGarmentIncoming\(message\.data\)\)/,
  )

  const stripFields = dashboardSource.slice(
    dashboardSource.indexOf('function stripLampOnlyFields'),
    dashboardSource.indexOf('function findDeviceByChipId'),
  )
  const captureBuilder = dashboardSource.slice(
    dashboardSource.indexOf('function buildLampAiIncomingFromCaptureResult'),
    dashboardSource.indexOf('function requestDurationSummaryRefresh'),
  )
  for (const field of ['resultVersion', 'segmentationFallback', 'outfitType', 'garments']) {
    assert.match(stripFields, new RegExp(`'${field}'`))
    assert.match(captureBuilder, new RegExp(`'${field}'`))
  }
  assert.match(captureBuilder, /normalizeGarmentIncoming\(incoming\)/)
  assert.match(
    dashboardSource,
    /message\.type === 'fabricRecognize'[\s\S]*?buildLampAiIncomingFromCaptureResult\(message\.data\)/,
  )
  assert.match(
    dashboardSource,
    /message\.type === 'cameraCaptureResult'[\s\S]*?buildLampAiIncomingFromCaptureResult\(message\.data\)/,
  )
})

test('AI response type declares structured fields without an any index signature', () => {
  const responseType = aiApiSource.slice(
    aiApiSource.indexOf('export interface FabricRecognizeRespVO'),
    aiApiSource.indexOf('export interface PersonDetectRespVO'),
  )

  assert.match(aiApiSource, /import type \{ GarmentPart, OutfitType \} from ['"]\.\.\/types\/device['"]/)
  assert.doesNotMatch(responseType, /\[key:\s*string\]:\s*any/)
  assert.match(responseType, /resultVersion\?: number/)
  assert.match(responseType, /segmentationFallback\?: boolean/)
  assert.match(responseType, /outfitType\?: OutfitType/)
  assert.match(responseType, /garments\?: GarmentPart\[\]/)
})
