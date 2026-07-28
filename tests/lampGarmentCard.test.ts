import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import * as garmentRecognition from '../src/utils/garmentRecognition.ts'

type RealtimeEnvelope = {
  id: number
  payload: Record<string, unknown>
  garmentState?: Record<string, unknown>
  lightControl?: boolean
}

type RealtimeBehaviorHelpers = {
  buildLampRealtimeUpdateEnvelope(input: RealtimeEnvelope): RealtimeEnvelope
  mergeLampRealtimeDeviceState(
    device: Record<string, unknown>,
    envelope: RealtimeEnvelope,
  ): Record<string, unknown>
}

function requireRealtimeBehaviorHelpers(): RealtimeBehaviorHelpers {
  const helpers = garmentRecognition as unknown as Partial<RealtimeBehaviorHelpers>
  assert.equal(
    typeof helpers.buildLampRealtimeUpdateEnvelope,
    'function',
    'shared helper must build the Card update envelope',
  )
  assert.equal(
    typeof helpers.mergeLampRealtimeDeviceState,
    'function',
    'shared helper must merge the Dashboard local snapshot',
  )
  return helpers as RealtimeBehaviorHelpers
}

const lampCardSource = readFileSync(
  new URL('../src/components/device/LampDeviceCard.vue', import.meta.url),
  'utf8',
)
const dashboardSource = readFileSync(
  new URL('../src/views/SmartLightDashboard.vue', import.meta.url),
  'utf8',
)

function sourceBlock(source: string, marker: string) {
  const start = source.indexOf(marker)
  assert.ok(start >= 0, `expected source marker: ${marker}`)

  const openingBrace = source.indexOf('{', start)
  assert.ok(openingBrace >= 0, `expected opening brace after: ${marker}`)

  let depth = 0
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] !== '}') continue
    depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }

  assert.fail(`expected closing brace after: ${marker}`)
}

function functionBlock(source: string, marker: string) {
  const start = source.indexOf(marker)
  assert.ok(start >= 0, `expected function marker: ${marker}`)

  const signatureEnd = source.indexOf(') {', start)
  assert.ok(signatureEnd >= 0, `expected function body after: ${marker}`)
  const openingBrace = signatureEnd + 2

  let depth = 0
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] !== '}') continue
    depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }

  assert.fail(`expected function closing brace after: ${marker}`)
}

function divBlockControlledBy(source: string, directive: string) {
  const directiveIndex = source.indexOf(directive)
  assert.ok(directiveIndex >= 0, `expected directive: ${directive}`)

  const start = source.lastIndexOf('<div', directiveIndex)
  assert.ok(start >= 0, `expected div before: ${directive}`)

  const tags = /<\/?div\b[^>]*>/g
  tags.lastIndex = start
  let depth = 0
  let match: RegExpExecArray | null

  while ((match = tags.exec(source)) !== null) {
    if (match[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return source.slice(start, tags.lastIndex)
    } else if (!match[0].endsWith('/>')) {
      depth += 1
    }
  }

  assert.fail(`expected closing div after: ${directive}`)
}

describe('lamp garment card contracts', () => {
  it('renders only normalized garments with one row and one color segment per real item', () => {
    assert.match(lampCardSource, /v-for="garment in displayGarments"/)
    assert.match(lampCardSource, /GARMENT_LABELS\[garment\.category\]/)
    assert.match(lampCardSource, /class="garment-color-segment"/)
    assert.match(lampCardSource, /garmentRgbCss\(garment\.mainColorRgb\)/)
    assert.match(lampCardSource, /garmentTextColor\(garment\.mainColorRgb\)/)
    assert.match(
      lampCardSource,
      /width:\s*displayGarments\.length\s*===\s*2\s*\?\s*['"]50%['"]\s*:\s*['"]100%['"]/,
    )
    assert.match(lampCardSource, /未识别服装/)
  })

  it('keeps the two-garment color bar horizontal with equal halves and a divider', () => {
    assert.match(
      lampCardSource,
      /\.garment-color-bar\s*\{[^}]*display:\s*flex;[^}]*overflow:\s*hidden;/,
    )
    assert.match(
      lampCardSource,
      /\.garment-color-segment\s*\{[^}]*flex-shrink:\s*1;/,
    )
    assert.match(
      lampCardSource,
      /\.garment-color-segment\s*\+\s*\.garment-color-segment\s*\{[^}]*border-left:/,
    )
    assert.match(
      lampCardSource,
      /:class="\{\s*'is-split':\s*displayGarments\.length\s*===\s*2\s*\}"/,
    )
  })

  it('shows the segmentation fallback hint only inside the preview modal', () => {
    const previewModal = divBlockControlledBy(
      lampCardSource,
      'v-if="showClothPreviewModal"',
    )
    const hintText = '未检测到明确区域，已按上装整图识别'

    assert.match(previewModal, /v-if="garmentState\.segmentationFallback"/)
    assert.ok(previewModal.includes(hintText))
    assert.equal(lampCardSource.split(hintText).length - 1, 1)
  })

  it('normalizes structured garment state from props and upload success', () => {
    assert.match(
      lampCardSource,
      /import\s*\{[\s\S]*?normalizeGarmentState[\s\S]*?getDisplayGarments[\s\S]*?GARMENT_LABELS[\s\S]*?garmentRgbCss[\s\S]*?garmentTextColor[\s\S]*?\}\s*from\s*['"]\.\.\/\.\.\/utils\/garmentRecognition['"]/,
    )
    assert.match(lampCardSource, /\bGarmentState\b/)
    assert.match(
      lampCardSource,
      /const\s+garmentState\s*=\s*ref<GarmentState>\(\{\s*garments:\s*\[\],?\s*\}\)/,
    )
    assert.match(
      lampCardSource,
      /const\s+displayGarments\s*=\s*computed\(\(\)\s*=>\s*getDisplayGarments\(\{\s*\.\.\.garmentState\.value,\s*fabric:\s*localForm\.fabric,\s*mainColorRgb:\s*localForm\.mainColorRgb,?\s*\}\)\)/,
    )

    const syncFromProps = sourceBlock(lampCardSource, 'function syncFromProps(')
    assert.match(
      syncFromProps,
      /garmentState\.value\s*=\s*normalizeGarmentState\(props\.device\)/,
    )
    assert.match(
      syncFromProps,
      /clothDetected\.value\s*=\s*garmentState\.value\.clothDetected\s*\?\?\s*null/,
    )

    const uploadHandler = sourceBlock(
      lampCardSource,
      'async function handleFabricFileChange(',
    )
    assert.match(
      uploadHandler,
      /garmentState\.value\s*=\s*normalizeGarmentState\(result\)/,
    )
    assert.match(
      uploadHandler,
      /clothDetected\.value\s*=\s*garmentState\.value\.clothDetected\s*\?\?\s*null/,
    )
    assert.match(uploadHandler, /emitRealtimeUpdate\(\)/)
  })

  it('keeps structured AI-only fields out of the device edit payload', () => {
    const realtimeEmitter = sourceBlock(lampCardSource, 'function emitRealtimeUpdate(')

    assert.match(realtimeEmitter, /fabric:\s*localForm\.fabric/)
    assert.match(realtimeEmitter, /mainColorRgb:\s*localForm\.mainColorRgb/)
    for (const field of [
      'resultVersion',
      'segmentationFallback',
      'outfitType',
      'garments',
      'clothDetected',
    ]) {
      assert.doesNotMatch(realtimeEmitter, new RegExp(`\\b${field}\\s*:`))
    }
  })

  it('executes the Card envelope to Dashboard merge while isolating the API payload', () => {
    const {
      buildLampRealtimeUpdateEnvelope,
      mergeLampRealtimeDeviceState,
    } = requireRealtimeBehaviorHelpers()
    const dressState = {
      resultVersion: 1,
      clothDetected: true,
      segmentationFallback: false,
      outfitType: 'dress',
      garments: [{
        position: 'fullBody',
        category: 'dress',
        categoryConfidence: 0.95,
        fabric: 'silk',
        mainColorRgb: '120,20,30',
        maskArea: 460,
      }],
    }
    const envelope = buildLampRealtimeUpdateEnvelope({
      id: 7,
      lightControl: true,
      garmentState: dressState,
      payload: {
        chipId: 'lamp-7',
        ip: '192.0.2.7',
        brightness: 66,
        fabric: 'silk',
        mainColorRgb: '120,20,30',
        garments: [{ category: 'upper' }],
        garmentState: { outfitType: 'upper_only' },
        outfitType: 'upper_only',
      },
    })
    const merged = mergeLampRealtimeDeviceState({
      id: 7,
      chipId: 'lamp-7',
      ...dressState,
    }, envelope)

    assert.equal(merged.brightness, 66)
    assert.equal(merged.outfitType, 'dress')
    assert.deepEqual(merged.garments, dressState.garments)
    assert.equal(Object.hasOwn(envelope.payload, 'garments'), false)
    assert.equal(Object.hasOwn(envelope.payload, 'garmentState'), false)
    assert.equal(Object.hasOwn(envelope.payload, 'outfitType'), false)

    const lampEmitType = sourceBlock(lampCardSource, 'const emit = defineEmits')
    assert.match(lampEmitType, /garmentState\?:\s*GarmentState/)

    const realtimeEmitter = sourceBlock(lampCardSource, 'function emitRealtimeUpdate(')
    assert.match(
      realtimeEmitter,
      /buildLampRealtimeUpdateEnvelope\(\{\s*id:\s*props\.device\.id,\s*lightControl,\s*garmentState:\s*garmentState\.value,\s*payload:\s*\{/,
    )

    assert.match(
      dashboardSource,
      /import\s+type\s*\{[\s\S]*?\bGarmentState\b[\s\S]*?\}\s*from\s*['"]\.\.\/types\/device['"]/,
    )
    const requestType = sourceBlock(dashboardSource, 'type RealtimeUpdateRequest')
    assert.match(requestType, /garmentState\?:\s*GarmentState/)

    const handler = functionBlock(dashboardSource, 'function handleRealtimeUpdate(')
    assert.match(
      handler,
      /\{\s*id,\s*payload,\s*garmentState,\s*lightControl\s*\}:\s*RealtimeUpdateRequest/,
    )
    assert.match(handler, /buildLampRealtimeUpdateEnvelope\(/)
    assert.match(handler, /mergeLampRealtimeDeviceState\(/)
    assert.match(handler, /const\s+safePayload\s*=\s*realtimeUpdate\.payload/)

    const realtimeState = sourceBlock(dashboardSource, 'interface RealtimeUpdateState')
    assert.match(realtimeState, /payload:\s*DeviceCreatePayload/)
    assert.doesNotMatch(realtimeState, /\bgarmentState\b/)

    const flushHandler = sourceBlock(dashboardSource, 'async function flushRealtimeUpdate(')
    assert.match(flushHandler, /const\s+payload\s*=\s*state\.payload/)
    assert.match(
      flushHandler,
      /await\s+updateDevice\(\s*id,\s*payload,\s*\{\s*lightControl\s*\}\s*\)/,
    )
    assert.doesNotMatch(flushHandler, /\bgarmentState\b/)
  })

  it('keeps an existing dress or separates state on an ordinary update with no AI keys', () => {
    const {
      buildLampRealtimeUpdateEnvelope,
      mergeLampRealtimeDeviceState,
    } = requireRealtimeBehaviorHelpers()
    const states = [{
      outfitType: 'dress',
      garments: [{
        position: 'fullBody',
        category: 'dress',
        fabric: 'silk',
        mainColorRgb: '1,2,3',
        maskArea: 400,
      }],
    }, {
      outfitType: 'separates',
      garments: [{
        position: 'upper',
        category: 'upper',
        fabric: 'cotton',
        mainColorRgb: '1,2,3',
        maskArea: 180,
      }, {
        position: 'lower',
        category: 'pants',
        fabric: 'denim',
        mainColorRgb: '4,5,6',
        maskArea: 220,
      }],
    }]

    for (const garmentState of states) {
      const current = {
        id: 8,
        chipId: 'lamp-8',
        brightness: 40,
        ...garmentState,
      }
      const ordinaryEnvelope = buildLampRealtimeUpdateEnvelope({
        id: 8,
        payload: {
          chipId: 'lamp-8',
          ip: '192.0.2.8',
          brightness: 72,
        },
      })
      const merged = mergeLampRealtimeDeviceState(current, ordinaryEnvelope)

      assert.equal(merged.brightness, 72)
      assert.equal(merged.outfitType, garmentState.outfitType)
      assert.deepEqual(merged.garments, garmentState.garments)
    }
  })

  it('describes each displayed garment and calls out area weighting for separates', () => {
    assert.match(
      lampCardSource,
      /displayGarments\.value\.map\(\s*garment\s*=>\s*`\$\{GARMENT_LABELS\[garment\.category\]\}：/,
    )
    assert.match(lampCardSource, /最终亮度和色温按服装区域面积加权/)
  })
})
