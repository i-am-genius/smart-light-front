import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { sanitizeLampDeviceUpdatePayload } from '../src/utils/garmentRecognition.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const typesSource = read('../src/types/device.ts')
const helperSource = read('../src/utils/garmentRecognition.ts')
const lampCardSource = read('../src/components/device/LampDeviceCard.vue')
const dashboardSource = read('../src/views/SmartLightDashboard.vue')

test('device payload persists the garment aiming mode', () => {
  assert.match(typesSource, /interface DeviceItem[\s\S]*?garmentAimEnabled\?: boolean/)
  assert.match(typesSource, /interface DeviceCreatePayload[\s\S]*?garmentAimEnabled\?: boolean/)
  assert.match(
    helperSource,
    /lampDeviceUpdatePayloadKeys[\s\S]*?['"]garmentAimEnabled['"]/,
  )
})

test('runtime payload sanitizer keeps only the persisted aiming switch', () => {
  const payload = sanitizeLampDeviceUpdatePayload({
    chipId: 'lamp-1',
    ip: '192.0.2.10',
    garmentAimEnabled: true,
    garments: [{ x: 1, y: 2, w: 3, h: 4 }],
  } as never)

  assert.equal(payload.garmentAimEnabled, true)
  assert.equal(Object.hasOwn(payload, 'garments'), false)
})

test('lamp card exposes default versus detected garment position control', () => {
  assert.match(
    lampCardSource,
    /v-model="localForm\.garmentAimEnabled"[\s\S]{0,180}?@change="handleGarmentAimModeChange"/,
  )
  assert.match(lampCardSource, /默认预设位置/)
  assert.match(lampCardSource, /最新服装识别位置/)
  assert.match(lampCardSource, /garmentAimEnabled:\s*false/)
  assert.match(
    lampCardSource,
    /localForm\.garmentAimEnabled\s*=\s*props\.device\.garmentAimEnabled\s*\?\?\s*false/,
  )
  assert.match(
    lampCardSource,
    /garmentAimEnabled:\s*localForm\.garmentAimEnabled\s*\?\?\s*false/,
  )
  assert.match(
    lampCardSource,
    /function handleGarmentAimModeChange\(\)\s*\{\s*emitRealtimeUpdate\(\)\s*\}/,
  )
})

test('camera devices strip the lamp-only aiming mode', () => {
  assert.match(
    dashboardSource,
    /const lampOnlyKeys[\s\S]*?['"]garmentAimEnabled['"]/,
  )
})
