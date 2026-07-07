import type { CamRoiItem, DeviceItem } from '../types/device'

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

function resolvePort(value: unknown, fallbackPort: number) {
  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && numericValue >= 1 && numericValue <= 65535) {
    return numericValue
  }
  return fallbackPort
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
  fallbackPort: number,
) {
  if (!target?.chipId) return roi

  const typedTarget = target as RoiTargetDevice
  const areaName = resolveTargetAreaName(typedTarget)
  const ip = trimText(target.ip)

  roi.targetChipId = target.chipId
  roi.areaName = areaName || roi.areaName || `区域 ${roi.targetIndex}`
  roi.udpIp = ip || roi.udpIp
  roi.udpPort = resolvePort(roi.udpPort, fallbackPort)

  return roi
}
