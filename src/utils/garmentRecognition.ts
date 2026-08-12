import type {
  DeviceCreatePayload,
  DeviceItem,
  GarmentCategory,
  GarmentPart,
  GarmentPosition,
  GarmentState,
  OutfitType,
} from '../types/device'

export type GarmentSource = {
  resultVersion?: unknown
  clothDetected?: unknown
  segmentationFallback?: unknown
  outfitType?: unknown
  fabric?: unknown
  label?: unknown
  mainColorRgb?: unknown
  garments?: unknown
}

export const GARMENT_LABELS: Record<GarmentCategory, string> = {
  upper: '上装',
  pants: '裤子',
  skirt: '裙子',
  dress: '连衣裙',
}

const allowedPosition = new Set<GarmentPosition>(['upper', 'lower', 'fullBody'])
const allowedCategory = new Set<GarmentCategory>(['upper', 'pants', 'skirt', 'dress'])
const allowedOutfitType = new Set<OutfitType>(['upper_only', 'lower_only', 'separates', 'dress'])

function finiteOptional(value: unknown): number | undefined {
  if (value == null) return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGarmentPosition(value: unknown): value is GarmentPosition {
  return typeof value === 'string' && allowedPosition.has(value as GarmentPosition)
}

function isGarmentCategory(value: unknown): value is GarmentCategory {
  return typeof value === 'string' && allowedCategory.has(value as GarmentCategory)
}

function isValidPositionCategory(position: GarmentPosition, category: GarmentCategory): boolean {
  if (position === 'upper') return category === 'upper'
  if (position === 'lower') return category === 'pants' || category === 'skirt'
  return category === 'dress'
}

function toGarmentPart(value: unknown): GarmentPart | undefined {
  if (!isRecord(value)) return undefined
  if (!isGarmentPosition(value.position) || !isGarmentCategory(value.category)) return undefined
  if (!isValidPositionCategory(value.position, value.category)) return undefined

  const categoryConfidence = finiteOptional(value.categoryConfidence)
  const fabricConfidence = finiteOptional(value.fabricConfidence)
  const maskArea = finiteOptional(value.maskArea)

  return {
    position: value.position,
    category: value.category,
    categoryConfidence: categoryConfidence ?? null,
    fabric: String(value.fabric || ''),
    fabricConfidence,
    mainColorRgb: String(value.mainColorRgb || ''),
    maskArea: Math.max(0, maskArea ?? 0),
    x: finiteOptional(value.x),
    y: finiteOptional(value.y),
    w: finiteOptional(value.w),
    h: finiteOptional(value.h),
  }
}

function sanitizeStructuredGarments(value: unknown): GarmentPart[] {
  if (!Array.isArray(value)) return []

  const garments: GarmentPart[] = []
  const positions = new Set<GarmentPosition>()

  for (const item of value) {
    const garment = toGarmentPart(item)
    if (!garment || positions.has(garment.position)) continue
    if (garments.some(existing => existing.position === 'fullBody')) continue
    if (garment.position === 'fullBody' && garments.length > 0) continue

    garments.push(garment)
    positions.add(garment.position)
    if (garments.length === 2) break
  }

  return garments
}

function legacyGarment(source: GarmentSource): GarmentPart[] {
  const fabric = String(source.fabric || source.label || '')
  const mainColorRgb = String(source.mainColorRgb || '')
  if (!fabric && !mainColorRgb) return []

  return [{
    position: 'upper',
    category: 'upper',
    categoryConfidence: null,
    fabric,
    mainColorRgb,
    maskArea: 0,
  }]
}

function inferOutfitType(garments: GarmentPart[]): OutfitType | undefined {
  if (garments.length === 1) {
    const [garment] = garments
    if (garment.position === 'upper') return 'upper_only'
    if (garment.position === 'lower') return 'lower_only'
    if (garment.position === 'fullBody') return 'dress'
    return undefined
  }

  if (
    garments.length === 2
    && garments.some(item => item.position === 'upper')
    && garments.some(item => item.position === 'lower')
  ) {
    return 'separates'
  }

  return undefined
}

function isOutfitType(value: unknown): value is OutfitType {
  return typeof value === 'string' && allowedOutfitType.has(value as OutfitType)
}

export function normalizeGarmentState(source: GarmentSource): GarmentState {
  const resultVersion = source.resultVersion == null
    ? undefined
    : finiteOptional(source.resultVersion)
  const acceptsStructuredVersion = source.resultVersion == null || resultVersion === 1
  const structuredGarments = acceptsStructuredVersion
    ? sanitizeStructuredGarments(source.garments)
    : []
  const garments = structuredGarments.length > 0
    ? structuredGarments
    : legacyGarment(source)
  const inferredOutfitType = inferOutfitType(garments)
  const declaredOutfitType = acceptsStructuredVersion && isOutfitType(source.outfitType)
    ? source.outfitType
    : undefined
  const state: GarmentState = { garments }

  if (resultVersion !== undefined) state.resultVersion = resultVersion
  if (acceptsStructuredVersion && typeof source.clothDetected === 'boolean') {
    state.clothDetected = source.clothDetected
  }
  if (acceptsStructuredVersion && typeof source.segmentationFallback === 'boolean') {
    state.segmentationFallback = source.segmentationFallback
  }
  if (declaredOutfitType !== undefined) {
    state.outfitType = declaredOutfitType
  } else if (inferredOutfitType !== undefined) {
    state.outfitType = inferredOutfitType
  }

  return state
}

export type LampRealtimeUpdateEnvelope = {
  id: number
  payload: DeviceCreatePayload
  garmentState?: GarmentState
  lightControl?: boolean
}

const lampDeviceUpdatePayloadKeys = [
  'chipId',
  'ip',
  'displayName',
  'deviceType',
  'deviceNo',
  'brightness',
  'temp',
  'autoMode',
  'garmentAimEnabled',
  'garmentDefaultPan',
  'garmentDefaultTilt',
  'personDefaultPan',
  'personDefaultTilt',
  'recommendedBrightness',
  'recommendedTemp',
  'fabric',
  'mainColorRgb',
] as const satisfies ReadonlyArray<keyof DeviceCreatePayload>

export function sanitizeLampDeviceUpdatePayload(
  payload: DeviceCreatePayload,
): DeviceCreatePayload {
  const sanitized = {} as DeviceCreatePayload

  for (const key of lampDeviceUpdatePayloadKeys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      Object.assign(sanitized, { [key]: payload[key] })
    }
  }

  return sanitized
}

export function buildLampRealtimeUpdateEnvelope(
  envelope: LampRealtimeUpdateEnvelope,
): LampRealtimeUpdateEnvelope {
  return {
    ...envelope,
    payload: sanitizeLampDeviceUpdatePayload(envelope.payload),
  }
}

export function mergeLampRealtimeDeviceState(
  device: DeviceItem,
  envelope: LampRealtimeUpdateEnvelope,
): DeviceItem {
  return {
    ...device,
    ...envelope.payload,
    ...(envelope.garmentState ?? {}),
  }
}

export function getDisplayGarments(source: GarmentSource): GarmentPart[] {
  return normalizeGarmentState(source).garments
}

export function garmentSignature(garments: GarmentPart[]): string {
  return garments
    .map(item => `${item.position}:${item.category}`)
    .sort()
    .join('|')
}

function parseRgb(rgb: string | undefined): [number, number, number] | undefined {
  if (!rgb) return undefined
  const values = rgb.match(/-?\d+(?:\.\d+)?/g)
  if (!values || values.length < 3) return undefined

  const channels = values.slice(0, 3).map(Number)
  if (channels.some(value => !Number.isFinite(value) || value < 0 || value > 255)) {
    return undefined
  }

  return channels as [number, number, number]
}

export function garmentRgbCss(rgb: string | undefined, fallback = '#888'): string {
  const channels = parseRgb(rgb)
  return channels ? `rgb(${channels.join(', ')})` : fallback
}

export function garmentTextColor(rgb: string | undefined): '#000' | '#fff' {
  const channels = parseRgb(rgb)
  if (!channels) return '#fff'

  const [red, green, blue] = channels
  const luminance = 0.299 * red + 0.587 * green + 0.114 * blue
  return luminance > 186 ? '#000' : '#fff'
}
