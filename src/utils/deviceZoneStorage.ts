import type { ZoneDefinition } from './deviceZones'

export const ZONE_DEFINITION_STORAGE_KEY = 'SMART_LIGHT_LAYOUT_ZONES'
export const ZONE_LAYOUT_STORAGE_KEY = 'SMART_LIGHT_THREE_ZONE_LAYOUTS_V1'

function isValidZoneDefinition(value: unknown): value is ZoneDefinition {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ZoneDefinition>
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0
}

export function loadZoneDefinitions(storage: Storage = localStorage): ZoneDefinition[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(ZONE_DEFINITION_STORAGE_KEY) || '[]')
    return Array.isArray(parsed)
      ? parsed
          .filter(isValidZoneDefinition)
          .map(zone => ({ id: zone.id.trim(), name: zone.name.trim() }))
      : []
  } catch {
    return []
  }
}

export function saveZoneDefinitions(
  zones: ZoneDefinition[],
  storage: Storage = localStorage,
): void {
  storage.setItem(ZONE_DEFINITION_STORAGE_KEY, JSON.stringify(zones))
}

export function removeStoredZoneLayout(
  zoneId: string,
  storage: Storage = localStorage,
): void {
  try {
    const raw = storage.getItem(ZONE_LAYOUT_STORAGE_KEY)
    if (!raw) return

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return

    const stored = parsed as {
      activeZoneId?: unknown
      zoneLayouts?: unknown
      [key: string]: unknown
    }
    if (!stored.zoneLayouts || typeof stored.zoneLayouts !== 'object' || Array.isArray(stored.zoneLayouts)) {
      return
    }

    const zoneLayouts = { ...(stored.zoneLayouts as Record<string, unknown>) }
    delete zoneLayouts[zoneId]
    storage.setItem(ZONE_LAYOUT_STORAGE_KEY, JSON.stringify({
      ...stored,
      activeZoneId: String(stored.activeZoneId ?? '') === zoneId ? '' : stored.activeZoneId,
      zoneLayouts,
    }))
  } catch {
    // Ignore malformed legacy storage; the layout component will recreate it.
  }
}
