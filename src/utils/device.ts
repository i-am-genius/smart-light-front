import type { DeviceItem } from '../types/device'

export function normalizeDeviceType(deviceType?: string | null): string {
  return String(deviceType || '').replace(/[-_\s]/g, '').toLowerCase()
}

export function isCameraDevice(device: Pick<DeviceItem, 'deviceType'>): boolean {
  return normalizeDeviceType(device.deviceType) === 'cam'
}

export function isLampDevice(device: Pick<DeviceItem, 'deviceType'>): boolean {
  const type = normalizeDeviceType(device.deviceType)
  return type === 'lamp' || type === 'camlamp'
}

export function isCaptureControllerDevice(device: Pick<DeviceItem, 'deviceType'>): boolean {
  return normalizeDeviceType(device.deviceType) === 'camcapture'
}
