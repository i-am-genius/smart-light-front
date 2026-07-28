import type { CamPtzPreset, CamRoiItem, DeviceItem } from '../types/device'

type RoiTargetDevice = DeviceItem & {
  name?: string
  areaName?: string
  zoneName?: string
}

function trimText(value: unknown) {
  return String(value ?? '').trim()
}

function resolveDeviceNo(target: DeviceItem) {
  return trimText(target.deviceNo)
}

function resolveTargetAreaName(target: RoiTargetDevice) {
  return trimText(target.areaName) || trimText(target.zoneName) || trimText(target.displayName)
}

function resolveTargetName(target: RoiTargetDevice) {
  return trimText(target.name) || trimText(target.displayName)
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value)
  const resolvedValue = Number.isFinite(numericValue) ? numericValue : fallback
  return Math.max(min, Math.min(max, resolvedValue))
}

export function getTargetDeviceLabel(target: DeviceItem, fallbackIndex: number) {
  const typedTarget = target as RoiTargetDevice
  const areaName = resolveTargetAreaName(typedTarget)
  const targetName = resolveTargetName(typedTarget)
  const deviceNo = resolveDeviceNo(target)

  if (areaName && deviceNo) return `${areaName} · 灯具-${deviceNo}`
  if (targetName && deviceNo) return `${targetName} · 灯具-${deviceNo}`
  if (deviceNo) return `灯具-${deviceNo}`
  if (areaName && targetName && areaName !== targetName) return `${areaName} · ${targetName}`
  if (targetName) return targetName
  if (target.chipId) return target.chipId
  return `灯具-${fallbackIndex}`
}

export function applyTargetDeviceToRoi(
  roi: CamRoiItem,
  target: DeviceItem | undefined,
) {
  if (!target?.chipId) return roi

  const typedTarget = target as RoiTargetDevice
  const areaName = resolveTargetAreaName(typedTarget)
  roi.targetChipId = target.chipId
  roi.areaName = areaName || roi.areaName || `区域 ${roi.targetIndex}`

  return roi
}

export function normalizeCamPreset(value: unknown): CamPtzPreset {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const legacyPan = Number(source.yaw)
  const panValue = source.pan ?? (Number.isFinite(legacyPan) ? legacyPan - 90 : undefined)

  return {
    pan: clampNumber(panValue, 0, -90, 90),
    tilt: clampNumber(source.tilt ?? source.pitch, 0, -45, 45),
    slider: clampNumber(source.slider, 0, 0, 1200),
  }
}

export function pickCamRoiFields(value: CamRoiItem): CamRoiItem {
  return {
    targetIndex: value.targetIndex,
    targetChipId: value.targetChipId,
    areaName: value.areaName,
    x: value.x,
    y: value.y,
    w: value.w,
    h: value.h,
  }
}
