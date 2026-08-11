import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DeviceItem, GarmentPart } from '../src/types/device.ts'
import { mergeDeviceListSnapshot } from '../src/utils/deviceListMerge.ts'

const recognizedUpper: GarmentPart = {
  position: 'upper',
  category: 'upper',
  fabric: 'cotton',
  mainColorRgb: '204, 51, 51',
  maskArea: 0.42,
}

function device(overrides: Partial<DeviceItem> = {}): DeviceItem {
  return {
    id: 1,
    chipId: 'LAMP-001',
    displayName: '新品展示区',
    deviceType: 'lamp',
    brightness: 60,
    ...overrides,
  }
}

describe('device list garment-state merge', () => {
  it('preserves the local recognition snapshot when a refresh returns empty defaults', () => {
    const existing = device({
      resultVersion: 1,
      clothDetected: true,
      outfitType: 'upper_only',
      garments: [recognizedUpper],
      fabric: 'cotton',
      mainColorRgb: '204, 51, 51',
    })
    const source = device({ brightness: 82, fabric: '', mainColorRgb: '', garments: [] })
    const normalizedSource = device({
      brightness: 82,
      fabric: '',
      mainColorRgb: '',
      garments: [],
    })

    const merged = mergeDeviceListSnapshot(existing, source, normalizedSource)

    assert.equal(merged.brightness, 82)
    assert.deepEqual(merged.garments, [recognizedUpper])
    assert.equal(merged.fabric, 'cotton')
    assert.equal(merged.mainColorRgb, '204, 51, 51')
    assert.equal(merged.outfitType, 'upper_only')
  })

  it('accepts a new non-empty recognition snapshot from the list endpoint', () => {
    const existing = device({ garments: [recognizedUpper] })
    const incomingDress: GarmentPart = {
      position: 'fullBody',
      category: 'dress',
      fabric: 'wool',
      mainColorRgb: '20, 40, 80',
      maskArea: 0.7,
    }
    const source = device({ outfitType: 'dress', garments: [incomingDress] })

    const merged = mergeDeviceListSnapshot(existing, source, source)

    assert.deepEqual(merged.garments, [incomingDress])
    assert.equal(merged.outfitType, 'dress')
  })

  it('accepts an explicit no-garment snapshot instead of restoring stale local data', () => {
    const existing = device({
      clothDetected: true,
      outfitType: 'upper_only',
      garments: [recognizedUpper],
    })
    const source = device({
      clothDetected: false,
      outfitType: 'upper_only',
      garments: [recognizedUpper],
      fabric: 'cotton',
      mainColorRgb: '204, 51, 51',
    })

    const merged = mergeDeviceListSnapshot(existing, source, source)

    assert.equal(merged.clothDetected, false)
    assert.deepEqual(merged.garments, [])
    assert.equal(merged.outfitType, undefined)
    assert.equal(merged.fabric, undefined)
    assert.equal(merged.mainColorRgb, undefined)
  })
})
