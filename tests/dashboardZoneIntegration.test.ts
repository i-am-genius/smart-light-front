import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync(
  new URL('../src/views/SmartLightDashboard.vue', import.meta.url),
  'utf8',
)
const deviceApiSource = readFileSync(
  new URL('../src/api/device.ts', import.meta.url),
  'utf8',
)
const zoneMutationSource = readFileSync(
  new URL('../src/utils/deviceZoneMutations.ts', import.meta.url),
  'utf8',
)

function functionSource(name: string) {
  const match = source.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\b[\\s\\S]*?\\n}`))
  assert.ok(match, `expected ${name} function`)
  return match[0]
}

describe('dashboard zone integration', () => {
  it('passes the shared zones and devices to every zone-aware child', () => {
    assert.match(source, /<DeviceGrid[\s\S]*?:zones="zoneDefinitions"/)
    assert.match(source, /<DeviceAddModal[\s\S]*?:zones="zoneDefinitions"[\s\S]*?:devices="devices"/)
    assert.match(source, /<ThreeLightingLayout[\s\S]*?:zones="zoneDefinitions"/)
  })

  it('owns and persists ordered zone definitions', () => {
    assert.match(source, /const\s+zoneDefinitions\s*=\s*ref<ZoneDefinition\[\]>\(loadZoneDefinitions\(\)\)/)
    assert.match(functionSource('syncZoneDefinitions'), /deriveZoneDefinitions/)
    assert.match(functionSource('handleZoneAdd'), /saveZoneDefinitions/)
    assert.match(functionSource('handleZoneMove'), /saveZoneDefinitions/)
  })

  it('migrates deleted-zone lamps only after draining delayed updates', () => {
    const handler = functionSource('handleZoneDelete')
    assert.match(handler, /flushRealtimeUpdatesFor/)
    assert.match(handler, /migrateDevicesToZone/)
    assert.ok(
      handler.indexOf('migrateDevicesToZone') < handler.indexOf('removeStoredZoneLayout'),
      'stored layout must only be removed after server migration succeeds',
    )
  })

  it('drains delayed updates before applying a persistent number swap', () => {
    const handler = functionSource('handleDeviceNumberSwap')
    assert.match(handler, /flushRealtimeUpdatesFor/)
    assert.match(handler, /swapDeviceNumbers/)
    assert.match(handler, /upsertDevice/)
  })

  it('normalizes realtime update queue keys as strings', () => {
    assert.match(source, /const\s+updateTimerMap\s*=\s*new Map<string, RealtimeUpdateState>\(\)/)
    assert.match(functionSource('handleRealtimeUpdate'), /const\s+deviceKey\s*=\s*String\(id\)/)
    assert.match(functionSource('flushRealtimeUpdatesFor'), /ids\.map\(String\)/)
    assert.doesNotMatch(functionSource('flushRealtimeUpdatesFor'), /ids\.map\(Number\)/)
  })

  it('preserves string device ids when sending persistent updates', () => {
    const flushHandler = functionSource('flushRealtimeUpdate')
    assert.match(flushHandler, /updateDevice\(id\s*,/)
    assert.doesNotMatch(flushHandler, /Number\(id\)/)
    assert.match(deviceApiSource, /function\s+updateDevice\([\s\S]*?id:\s*string\s*\|\s*number/)
    assert.match(zoneMutationSource, /type\s+DeviceUpdateOperation\s*=\s*\([\s\S]*?id:\s*string\s*\|\s*number/)
  })

  it('wires all layout management events', () => {
    assert.match(source, /@zone-add="handleZoneAdd"/)
    assert.match(source, /@zone-delete="handleZoneDelete"/)
    assert.match(source, /@zone-move="handleZoneMove"/)
    assert.match(source, /@swap-device-numbers="handleDeviceNumberSwap"/)
  })
})
