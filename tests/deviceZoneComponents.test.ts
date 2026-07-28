import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

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

function componentTag(source: string, componentName: string) {
  const match = source.match(new RegExp(`<${componentName}\\b[\\s\\S]*?\\/?>`))
  assert.ok(match, `expected <${componentName}> component`)
  return match[0]
}

function elementBlockByClass(source: string, className: string) {
  const start = source.search(new RegExp(`<div\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`))
  assert.ok(start >= 0, `expected element with class: ${className}`)

  const tags = /<\/?div\b[^>]*>/g
  tags.lastIndex = start
  let depth = 0
  for (const match of source.matchAll(tags)) {
    if ((match.index ?? -1) < start) continue
    if (match[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return source.slice(start, (match.index ?? 0) + match[0].length)
    } else if (!match[0].endsWith('/>')) {
      depth += 1
    }
  }

  assert.fail(`expected closing div for class: ${className}`)
}

const dashboardSource = readSource('../src/views/SmartLightDashboard.vue')
const deviceGridSource = readSource('../src/components/device/DeviceGrid.vue')
const deviceCardSource = readSource('../src/components/device/DeviceCard.vue')
const lampCardSource = readSource('../src/components/device/LampDeviceCard.vue')
const addModalSource = readSource('../src/components/device/DeviceAddModal.vue')
const layoutSource = readSource('../src/components/device/ThreeLightingLayout.vue')

describe('device zone component contracts', () => {
  it('renders DeviceGrid from a derived sorted copy without mutating the source devices', () => {
    assert.match(
      deviceGridSource,
      /const\s+sortedDevices\s*=\s*computed\(\(\)\s*=>\s*sortBoundDevices\(\s*props\.devices\s*,\s*props\.zones\s*\)\s*\)/,
    )
    assert.match(deviceGridSource, /v-for="device in sortedDevices"/)
    assert.match(deviceGridSource, /:all-devices="sortedDevices"/)
  })

  it('passes the shared ordered zones through the bound-device card chain', () => {
    assert.match(componentTag(dashboardSource, 'DeviceGrid'), /:zones="zoneDefinitions"/)
    assert.match(componentTag(deviceGridSource, 'DeviceCard'), /:zones="zones"/)
    assert.match(componentTag(deviceCardSource, 'LampDeviceCard'), /:zones="zones"/)
  })

  it('preserves the shared realtime envelope type through both card relay layers', () => {
    for (const source of [deviceCardSource, deviceGridSource]) {
      assert.match(
        source,
        /import\s+type\s*\{\s*LampRealtimeUpdateEnvelope\s*\}\s*from\s*['"]\.\.\/\.\.\/utils\/garmentRecognition['"]/,
      )

      const emits = sourceBlock(source, 'defineEmits')
      assert.match(
        emits,
        /\(e:\s*['"]update-realtime['"],\s*value:\s*LampRealtimeUpdateEnvelope\):\s*void/,
      )
      assert.doesNotMatch(emits, /payload:\s*DeviceCreatePayload/)
    }
  })

  it('uses a zone selector and a derived gap-filling number for scanned lamps', () => {
    assert.match(addModalSource, /const\s+isScannedZoneDevice\s*=\s*computed/)
    assert.match(addModalSource, /v-if="isScannedZoneDevice"[\s\S]*?<BaseSelect/)
    assert.match(
      addModalSource,
      /findSmallestAvailableDeviceNo\(\s*props\.devices\s*,\s*zoneName\s*\)/,
    )

    const modalTag = componentTag(dashboardSource, 'DeviceAddModal')
    assert.match(modalTag, /:devices="devices"/)
    assert.match(modalTag, /:zones="zoneDefinitions"/)
  })

  it('keeps the lamp zone selector inside the existing information-cell appearance', () => {
    assert.match(lampCardSource, /class="device-info-cell editable zone-select-cell"/)
    assert.match(
      lampCardSource,
      /class="device-info-cell editable zone-select-cell"[\s\S]*?<BaseSelect[\s\S]*?class="zone-cell-select"/,
    )
    assert.match(
      lampCardSource,
      /\.zone-cell-select\s*:deep\(\.select-trigger\)\s*\{[^}]*border:\s*0(?:\s+none)?\s*;/,
    )
    assert.match(
      lampCardSource,
      /:global\(body:has\(\.app-container\.night-mode\)\)\s+\.zone-cell-select\s+:deep\(\.select-trigger\)\s*\{[^}]*background:\s*transparent\s*;[^}]*border:\s*0(?:\s+none)?\s*;[^}]*box-shadow:\s*none\s*;/,
    )
  })

  it('keeps the current number when the lamp selects its existing zone', () => {
    const zoneChangeHandler = sourceBlock(lampCardSource, 'function handleZoneChange(')
    assert.match(
      zoneChangeHandler,
      /if\s*\(\s*normalizeZoneName\(zoneName\)\s*===\s*normalizeZoneName\(localForm\.displayName\)\s*\)\s*return/,
    )
    assert.ok(
      zoneChangeHandler.indexOf('normalizeZoneName(zoneName)') < zoneChangeHandler.indexOf('localForm.deviceNo ='),
      'same-zone guard must run before assigning a gap-filling number',
    )
  })

  it('renders a compact zone manager below the scene and emits mutation intents', () => {
    const viewportBlock = elementBlockByClass(layoutSource, 'three-viewport-wrap')
    const viewportStart = layoutSource.indexOf(viewportBlock)
    const viewportEnd = viewportStart + viewportBlock.length
    const managerStart = layoutSource.indexOf('class="zone-quick-manager"')
    assert.ok(managerStart > viewportEnd, 'expected the quick zone manager below the scene viewport')
    assert.match(layoutSource, /@click="submitZoneAdd"/)
    assert.match(layoutSource, /@click="requestActiveZoneDelete"/)
    assert.match(layoutSource, /@click="requestZoneMove\(-1\)"/)
    assert.match(layoutSource, /@click="requestZoneMove\(1\)"/)
    assert.match(layoutSource, /\(event:\s*'zone-add',\s*name:\s*string\)/)
    assert.match(layoutSource, /\(event:\s*'zone-delete'/)
    assert.match(layoutSource, /\(event:\s*'zone-move'/)

    const layoutTag = componentTag(dashboardSource, 'ThreeLightingLayout')
    assert.match(layoutTag, /:zones="zoneDefinitions"/)
    assert.match(
      layoutTag,
      /:zone-management-pending="zoneManagementPending(?:\s*\|\|\s*deviceMutationPending)?"/,
    )
    assert.match(layoutTag, /@zone-add="handleZoneAdd"/)
    assert.match(layoutTag, /@zone-delete="handleZoneDelete"/)
    assert.match(layoutTag, /@zone-move="handleZoneMove"/)
  })

  it('rebuilds real lamp slots in numeric device order without cached real-slot geometry', () => {
    const lampLookup = sourceBlock(layoutSource, 'function getLampDevicesForZone(')
    const rebuildLayout = sourceBlock(layoutSource, 'function rebuildActiveZoneLayout(')
    const realSlotBuilder = sourceBlock(layoutSource, 'function buildZoneSlots(')

    assert.match(`${rebuildLayout}\n${lampLookup}`, /sortDevicesByNumber\(/)
    assert.match(
      realSlotBuilder,
      /const\s+fallbackX\s*=\s*getDefaultSlotX\(\s*index\s*,\s*Math\.max\(\s*zoneLampDevices\.length\s*,\s*1\s*\)\s*\)/,
    )
    assert.match(realSlotBuilder, /(?:const\s+order\s*=\s*index|order:\s*index)/)
    assert.match(realSlotBuilder, /lampX:\s*fallbackX/)
    assert.match(realSlotBuilder, /targetX:\s*fallbackX/)
    assert.doesNotMatch(realSlotBuilder, /existing\?\.order\s*\?\?\s*index/)
    assert.doesNotMatch(realSlotBuilder, /existing\?\.lampX\s*\?\?\s*fallbackX/)
    assert.doesNotMatch(realSlotBuilder, /existing\?\.targetX\s*\?\?\s*fallbackX/)
  })

  it('emits persistent number swaps only for adjacent real slots and keeps manual moves local', () => {
    const moveSelectedSlot = sourceBlock(layoutSource, 'function moveSelectedSlot(')

    assert.match(
      moveSelectedSlot,
      /isRealDeviceSlot\(current\)\s*&&\s*isRealDeviceSlot\(target\)/,
    )
    assert.match(moveSelectedSlot, /emit\(\s*'swap-device-numbers'/)
    assert.match(moveSelectedSlot, /applySlotOrderLayout\(\)/)
    assert.match(layoutSource, /\(event:\s*'swap-device-numbers'/)

    const layoutTag = componentTag(dashboardSource, 'ThreeLightingLayout')
    assert.match(layoutTag, /@swap-device-numbers="handleDeviceNumberSwap"/)
  })

  it('rebuilds when numeric device ordering changes without changing slot membership', () => {
    const syncFunction = sourceBlock(layoutSource, 'function syncActiveZoneLampCount(')
    assert.match(syncFunction, /hasDeviceOrderChanged/)
    assert.match(syncFunction, /existingDeviceSlotIds\[index\]\s*!==\s*slotId/)
  })

  it('preserves stored manual-slot placement while refilling real slots numerically', () => {
    const buildFunction = sourceBlock(layoutSource, 'function buildZoneSlots(')
    assert.match(buildFunction, /mergeDeviceSlotsWithManualOrder\(/)
    assert.match(layoutSource, /function\s+mergeDeviceSlotsWithManualOrder\(/)
  })
})
