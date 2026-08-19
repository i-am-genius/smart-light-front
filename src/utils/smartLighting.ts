import type { CamCaptureTaskResult, DeviceCreatePayload, DeviceItem } from '../types/device'
import { isCameraDevice, isLampDevice } from './device'

const FAILED_CAPTURE_STATUSES = new Set([
  'motion_command_failed',
  'motion_timeout',
  'camera_offline',
  'camera_command_failed',
  'upload_failed',
  'timeout',
  'photo_saved_ai_failed',
  'error',
  'cancelled',
])

const ACTIVE_CAPTURE_STATUSES = new Set([
  'queued',
  'waiting_motion',
  'capturing',
  'uploading',
  'image_received',
  'ai_processing',
])

export function normalizeSmartLightingChipId(value?: string) {
  return String(value || '').trim().toUpperCase()
}

export function getSmartLightingCamera(devices: DeviceItem[]) {
  return devices.find(device => isCameraDevice(device)) || null
}

export function getSmartLightingLamps(devices: DeviceItem[]) {
  return devices.filter(isLampDevice)
}

export function buildSmartLightingLampPayload(device: DeviceItem): DeviceCreatePayload {
  return {
    chipId: device.chipId,
    ip: device.ip || '',
    displayName: device.displayName || '',
    deviceType: device.deviceType || 'lamp',
    deviceNo: device.deviceNo || '',
    brightness: device.brightness ?? 50,
    temp: device.temp ?? 4000,
    autoMode: true,
    garmentAimEnabled: true,
    garmentDefaultPan: device.garmentDefaultPan ?? 0,
    garmentDefaultTilt: device.garmentDefaultTilt ?? 20,
    personDefaultPan: device.personDefaultPan ?? 0,
    personDefaultTilt: device.personDefaultTilt ?? -30,
    recommendedBrightness: device.recommendedBrightness ?? 50,
    recommendedTemp: device.recommendedTemp ?? 4000,
    fabric: device.fabric || '',
    mainColorRgb: device.mainColorRgb || '',
  }
}

export function getSmartLightingBatchTasks(
  device: DeviceItem | null | undefined,
  batchId: string,
  taskIds: string[],
): CamCaptureTaskResult[] {
  if (!device) return []
  const ids = new Set(taskIds)
  return (device.camCaptureTasks || []).filter(task => (
    task.batchId === batchId || ids.has(task.taskId)
  ))
}

export function isSmartLightingTaskFailed(task: CamCaptureTaskResult) {
  return FAILED_CAPTURE_STATUSES.has(String(task.status || '').toLowerCase())
}

export function isSmartLightingTaskDone(task: CamCaptureTaskResult) {
  return String(task.status || '').toLowerCase() === 'ai_done'
}

export function isSmartLightingTaskActive(task: CamCaptureTaskResult) {
  return ACTIVE_CAPTURE_STATUSES.has(String(task.status || '').toLowerCase())
}
