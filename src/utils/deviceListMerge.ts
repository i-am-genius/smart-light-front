import type { DeviceItem } from '../types/device.ts'

const garmentSnapshotKeys: Array<keyof DeviceItem> = [
  'resultVersion',
  'clothDetected',
  'segmentationFallback',
  'outfitType',
  'garments',
  'fabric',
  'label',
  'confidence',
  'fabricConfidence',
  'mainColorRgb',
]

function hasOwn(source: Partial<DeviceItem>, key: keyof DeviceItem) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

/**
 * Merges an item returned by the full device-list endpoint with its locally
 * enriched state. List DTOs may contain empty/default garment fields even
 * though the latest recognition state only arrived over WebSocket.
 */
export function mergeDeviceListSnapshot(
  existing: DeviceItem | undefined,
  source: DeviceItem,
  normalizedSource: DeviceItem,
): DeviceItem {
  const merged = { ...(existing || {}), ...normalizedSource } as DeviceItem

  if (!existing) {
    return merged
  }

  if (source.clothDetected === false) {
    for (const key of garmentSnapshotKeys) {
      if (!hasOwn(normalizedSource, key)) delete merged[key]
    }
    return merged
  }

  if (normalizedSource.garments?.length) return merged

  for (const key of garmentSnapshotKeys) {
    if (hasOwn(existing, key)) {
      Object.assign(merged, { [key]: existing[key] })
    } else {
      delete merged[key]
    }
  }

  return merged
}
