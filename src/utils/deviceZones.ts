import type { DeviceCreatePayload, DeviceItem } from '../types/device'
import { isCameraDevice, isLampDevice } from './device.ts'

export interface ZoneDefinition {
  id: string
  name: string
}

export interface ZoneMoveAssignment {
  device: DeviceItem
  deviceNo: string
}

export const UNASSIGNED_ZONE_NAME = '未分区'

export function normalizeZoneName(value: unknown): string {
  const normalized = String(value ?? '').trim()
  return !normalized || normalized === '-' ? UNASSIGNED_ZONE_NAME : normalized
}

function createDerivedZoneId(name: string): string {
  return `device-zone-${name}`
}

function parsePositiveDeviceNo(value: unknown): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY
}

export function deriveZoneDefinitions(
  storedZones: ZoneDefinition[],
  devices: DeviceItem[],
): ZoneDefinition[] {
  const result: ZoneDefinition[] = []
  const seen = new Set<string>()

  const appendZone = (id: string, value: unknown) => {
    const name = normalizeZoneName(value)
    if (name === UNASSIGNED_ZONE_NAME || seen.has(name)) return
    seen.add(name)
    result.push({ id: String(id || createDerivedZoneId(name)), name })
  }

  for (const zone of storedZones) {
    appendZone(zone.id, zone.name)
  }
  for (const item of devices) {
    if (isLampDevice(item)) {
      const name = normalizeZoneName(item.displayName)
      appendZone(createDerivedZoneId(name), name)
    }
  }

  return result
}

export function buildZoneSelectOptions(zones: ZoneDefinition[]) {
  const names = [UNASSIGNED_ZONE_NAME, ...zones.map(zone => normalizeZoneName(zone.name))]
  return [...new Set(names)]
    .filter(Boolean)
    .map(name => ({ label: name, value: name }))
}

export function sortDevicesByNumber<T extends Pick<DeviceItem, 'deviceNo'>>(devices: T[]): T[] {
  return devices
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftNo = parsePositiveDeviceNo(left.item.deviceNo)
      const rightNo = parsePositiveDeviceNo(right.item.deviceNo)
      return leftNo - rightNo || left.index - right.index
    })
    .map(entry => entry.item)
}

export function sortBoundDevices(
  devices: DeviceItem[],
  zones: ZoneDefinition[],
): DeviceItem[] {
  const orderedZones = deriveZoneDefinitions(zones, devices)
  const zoneIndexes = new Map(orderedZones.map((zone, index) => [zone.name, index]))
  const fallbackZoneIndex = orderedZones.length

  return devices
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const cameraOrder = Number(isCameraDevice(right.item)) - Number(isCameraDevice(left.item))
      if (cameraOrder) return cameraOrder
      if (isCameraDevice(left.item)) return left.index - right.index

      const leftZone = zoneIndexes.get(normalizeZoneName(left.item.displayName)) ?? fallbackZoneIndex
      const rightZone = zoneIndexes.get(normalizeZoneName(right.item.displayName)) ?? fallbackZoneIndex
      if (leftZone !== rightZone) return leftZone - rightZone

      const deviceNoOrder = parsePositiveDeviceNo(left.item.deviceNo) - parsePositiveDeviceNo(right.item.deviceNo)
      return deviceNoOrder || left.index - right.index
    })
    .map(entry => entry.item)
}

export function findSmallestAvailableDeviceNo(
  devices: DeviceItem[],
  zoneName: string,
  excludedId?: string | number,
): string {
  const normalizedZoneName = normalizeZoneName(zoneName)
  const occupied = new Set(
    devices
      .filter(isLampDevice)
      .filter(item => normalizeZoneName(item.displayName) === normalizedZoneName)
      .filter(item => excludedId == null || String(item.id) !== String(excludedId))
      .map(item => parsePositiveDeviceNo(item.deviceNo))
      .filter(Number.isFinite),
  )

  let candidate = 1
  while (occupied.has(candidate)) candidate += 1
  return String(candidate)
}

export function buildZoneMoveAssignments(
  movingDevices: DeviceItem[],
  allDevices: DeviceItem[],
  targetZoneName: string,
): ZoneMoveAssignment[] {
  const movingIds = new Set(movingDevices.map(item => String(item.id)))
  const normalizedTargetZone = normalizeZoneName(targetZoneName)
  const occupied = new Set(
    allDevices
      .filter(isLampDevice)
      .filter(item => !movingIds.has(String(item.id)))
      .filter(item => normalizeZoneName(item.displayName) === normalizedTargetZone)
      .map(item => parsePositiveDeviceNo(item.deviceNo))
      .filter(Number.isFinite),
  )

  return sortDevicesByNumber(movingDevices.filter(isLampDevice)).map(item => {
    let candidate = 1
    while (occupied.has(candidate)) candidate += 1
    occupied.add(candidate)
    return { device: item, deviceNo: String(candidate) }
  })
}

export function buildDeviceNumberSwapSteps(
  first: DeviceItem,
  second: DeviceItem,
  zoneDevices: DeviceItem[],
): ZoneMoveAssignment[] {
  const firstZone = normalizeZoneName(first.displayName)
  const secondZone = normalizeZoneName(second.displayName)
  const firstNo = parsePositiveDeviceNo(first.deviceNo)
  const secondNo = parsePositiveDeviceNo(second.deviceNo)

  if (firstZone !== secondZone || !Number.isFinite(firstNo) || !Number.isFinite(secondNo) || firstNo === secondNo) {
    throw new Error('Only distinct numbered lamps in the same zone can be swapped')
  }

  const temporaryNo = findSmallestAvailableDeviceNo(zoneDevices, firstZone)
  return [
    { device: first, deviceNo: temporaryNo },
    { device: second, deviceNo: String(firstNo) },
    { device: first, deviceNo: String(secondNo) },
  ]
}

export function buildDeviceUpdatePayload(
  device: DeviceItem,
  overrides: Partial<DeviceCreatePayload> = {},
): DeviceCreatePayload {
  return {
    chipId: device.chipId || '',
    ip: device.ip || '',
    displayName: device.displayName,
    deviceType: device.deviceType,
    deviceNo: device.deviceNo,
    brightness: device.brightness,
    temp: device.temp,
    autoMode: device.autoMode,
    recommendedBrightness: device.recommendedBrightness,
    recommendedTemp: device.recommendedTemp,
    fabric: device.fabric,
    mainColorRgb: device.mainColorRgb,
    ...overrides,
  }
}
