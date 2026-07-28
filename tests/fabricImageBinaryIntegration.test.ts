import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const dashboard = readFileSync(
  new URL('../src/views/SmartLightDashboard.vue', import.meta.url),
  'utf8',
)
const lampCard = readFileSync(
  new URL('../src/components/device/LampDeviceCard.vue', import.meta.url),
  'utf8',
)
const deviceTypes = readFileSync(
  new URL('../src/types/device.ts', import.meta.url),
  'utf8',
)
const useWebSocket = readFileSync(
  new URL('../src/composables/useWebSocket.ts', import.meta.url),
  'utf8',
)

describe('Web binary fabric image integration', () => {
  it('declares capability only after connection and initial device load', () => {
    assert.match(dashboard, /fabricImageBinary:\s*true/)
    assert.match(dashboard, /version:\s*1/)
    assert.match(dashboard, /initialDevicesLoaded/)
    assert.match(dashboard, /watch\(\s*\[connected,\s*initialDevicesLoaded\]/)
    assert.match(dashboard, /fabricImageCapabilityDeclared/)
  })

  it('assembles binary frames and owns Blob URL lifecycle', () => {
    assert.match(dashboard, /new FabricImageAssembler\(\)/)
    assert.match(dashboard, /URL\.createObjectURL\(image\.blob\)/)
    assert.match(dashboard, /URL\.revokeObjectURL/)
    assert.match(dashboard, /assembler\.reset\(\)/)
    assert.match(dashboard, /handleFabricImageBinary/)
  })

  it('routes ArrayBuffer messages without changing text handling', () => {
    assert.match(useWebSocket, /ws\.binaryType\s*=\s*'arraybuffer'/)
    assert.match(useWebSocket, /event\.data instanceof ArrayBuffer/)
    assert.match(useWebSocket, /onBinaryMessage\?\.\(event\.data\)/)
    assert.match(useWebSocket, /typeof event\.data !== 'string'/)
  })

  it('stores image identity on devices and prefers Blob URL in lamp cards', () => {
    assert.match(deviceTypes, /annotatedImageBlobUrl\?: string/)
    assert.match(deviceTypes, /annotatedImageId\?: string/)
    assert.match(lampCard, /props\.device\.annotatedImageBlobUrl/)
    assert.match(lampCard, /props\.device\.annotatedImageUrl/)
    assert.match(lampCard, /v-if="annotatedImageSrc"/)
  })
})
