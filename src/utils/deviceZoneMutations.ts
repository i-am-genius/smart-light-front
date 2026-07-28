import type { DeviceCreatePayload, DeviceItem } from '../types/device'
import {
  buildDeviceNumberSwapSteps,
  buildDeviceUpdatePayload,
  buildZoneMoveAssignments,
} from './deviceZones.ts'

export type DeviceUpdateOperation = (
  id: string | number,
  payload: DeviceCreatePayload,
) => Promise<boolean>

async function applyDeviceUpdate(
  device: DeviceItem,
  overrides: Partial<DeviceCreatePayload>,
  updateDevice: DeviceUpdateOperation,
) {
  const payload = buildDeviceUpdatePayload(device, overrides)
  const updated = await updateDevice(device.id, payload)
  if (!updated) throw new Error(`Device update returned false for ${String(device.id)}`)
  return { ...device, ...overrides }
}

export async function migrateDevicesToZone(
  movingDevices: DeviceItem[],
  allDevices: DeviceItem[],
  targetZoneName: string,
  updateDevice: DeviceUpdateOperation,
): Promise<DeviceItem[]> {
  const assignments = buildZoneMoveAssignments(movingDevices, allDevices, targetZoneName)
  const updatedDevices: DeviceItem[] = []

  for (const assignment of assignments) {
    updatedDevices.push(await applyDeviceUpdate(
      assignment.device,
      { displayName: targetZoneName, deviceNo: assignment.deviceNo },
      updateDevice,
    ))
  }

  return updatedDevices
}

export async function swapDeviceNumbers(
  first: DeviceItem,
  second: DeviceItem,
  zoneDevices: DeviceItem[],
  updateDevice: DeviceUpdateOperation,
): Promise<DeviceItem[]> {
  const steps = buildDeviceNumberSwapSteps(first, second, zoneDevices)

  for (const step of steps) {
    await applyDeviceUpdate(step.device, { deviceNo: step.deviceNo }, updateDevice)
  }

  return [
    { ...first, deviceNo: second.deviceNo },
    { ...second, deviceNo: first.deviceNo },
  ]
}
