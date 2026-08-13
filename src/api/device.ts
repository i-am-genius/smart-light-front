import http from './http'
import type {
  DeviceCreatePayload,
  DeviceItem,
  DeviceOnlineItem,
  CameraAimTargetPayload,
  CamCaptureTaskPayload,
  CamCaptureTaskResult,
  CamCaptureBatchPayload,
  CamCaptureBatchResult,
  CamPresenceState,
  CamRoiConfig,
  CamStatusState,
  CamTrackingControlPayload,
  CamTrackingControlResult,
  CameraPtzPayload,
  FirmwareHistoryParams,
  FirmwareItem,
  FirmwareUploadResult,
  FirmwareChannel,
  GarmentAimCalibrationSamplePayload,
  GarmentAimCalibrationStatus,
  OtaCheckResult,
} from '../types/device'

interface CommonResult<T> {
  code: number
  msg: string
  data: T
}

export async function getDeviceList(): Promise<DeviceItem[]> {
  const res = await http.get<CommonResult<DeviceItem[]>>('/admin/device/list')
  return res.data.data || []
}

export async function getOnlineList(): Promise<DeviceOnlineItem[]> {
  const res = await http.get<CommonResult<DeviceOnlineItem[]>>('/admin/device/online-list')
  return res.data.data || []
}

export async function getMyDeviceListApi(): Promise<DeviceItem[]> {
  const res = await http.get<CommonResult<DeviceItem[]>>('/admin/device/my-list')
  return res.data.data || []
}

export async function createDevice(payload: DeviceCreatePayload): Promise<number> {
  const res = await http.post<CommonResult<number>>('/admin/device/create', payload)
  return res.data.data
}

export interface UpdateDeviceOptions {
  lightControl?: boolean
}

export async function updateDevice(
  id: string | number,
  payload: DeviceCreatePayload,
  options: UpdateDeviceOptions = {},
): Promise<boolean> {
  const res = await http.put<CommonResult<boolean>>(
    `/admin/device/update/${id}`,
    payload,
    options.lightControl ? { params: { lightControl: true } } : undefined,
  )
  return res.data.data
}

export async function deleteDevice(id: number): Promise<boolean> {
  const res = await http.delete<CommonResult<boolean>>(`/admin/device/delete/${id}`)
  return res.data.data
}

export type ArmControlSpeed = 'slow' | 'normal' | 'fast'

/** 单独发送云台速度切换，不触发方向动作 */
export async function sendArmSpeed(chipId: string, speed: ArmControlSpeed): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(`/admin/device/arm/${chipId}`, {
    type: 'arm_speed',
    speed,
  })
  return res.data.data
}

/** 发送云台方向动作，不带 speed 字段 */
export async function sendArmAction(
  chipId: string,
  action: string,
  position?: number,
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    type: 'arm',
    action,
  }

  if (position !== undefined) {
    payload.position = position
  }

  const res = await http.post<CommonResult<boolean>>(`/admin/device/arm/${chipId}`, payload)
  return res.data.data
}

/** 摇杆连续控制：按住时调用。前端每 250ms 续期一次 */
export async function sendArmJoystick(
  chipId: string,
  x: number,
  y: number,
  durationMs = 300,
): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(`/admin/device/arm/${chipId}`, {
    type: 'arm_joystick',
    x,
    y,
    durationMs,
  })
  return res.data.data
}

/** 停止摇杆运动：松开/离开/卸载/进入精确模式时调用 */
export async function sendArmStop(chipId: string): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(`/admin/device/arm/${chipId}`, {
    type: 'arm_stop',
  })
  return res.data.data
}

/** 精确模式位置控制：允许部分字段更新 */
export async function sendArmPosition(
  chipId: string,
  position: { pan?: number; tilt?: number; slider?: number },
): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(`/admin/device/arm/${chipId}`, {
    type: 'arm_position',
    ...position,
  })
  return res.data.data
}

export async function getGarmentAimCalibration(
  lampChipId: string,
): Promise<GarmentAimCalibrationStatus> {
  const res = await http.get<CommonResult<GarmentAimCalibrationStatus>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/garment-aim-calibration`,
  )
  return res.data.data
}

export async function addGarmentAimCalibrationSample(
  lampChipId: string,
  payload: GarmentAimCalibrationSamplePayload,
): Promise<GarmentAimCalibrationStatus> {
  const res = await http.post<CommonResult<GarmentAimCalibrationStatus>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/garment-aim-calibration/samples`,
    payload,
  )
  return res.data.data
}

export async function clearGarmentAimCalibration(
  lampChipId: string,
): Promise<GarmentAimCalibrationStatus> {
  const res = await http.delete<CommonResult<GarmentAimCalibrationStatus>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/garment-aim-calibration`,
  )
  return res.data.data
}

export async function sendCamPtz(payload: CameraPtzPayload): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>('/admin/device/cam/ptz', payload)
  return res.data.data
}

export async function sendCamAimTarget(payload: CameraAimTargetPayload): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>('/admin/device/cam/aim-target', payload)
  return res.data.data
}

export async function startCamTracking(
  payload: CamTrackingControlPayload,
): Promise<CamTrackingControlResult> {
  const res = await http.post<CommonResult<CamTrackingControlResult>>(
    '/admin/device/cam/tracking/start',
    payload,
  )
  return res.data.data
}

export async function stopCamTracking(
  payload: CamTrackingControlPayload,
): Promise<CamTrackingControlResult> {
  const res = await http.post<CommonResult<CamTrackingControlResult>>(
    '/admin/device/cam/tracking/stop',
    payload,
  )
  return res.data.data
}

export async function getCamRoiConfig(camChipId: string): Promise<CamRoiConfig> {
  const res = await http.get<CommonResult<CamRoiConfig>>(
    `/admin/device/cam/${encodeURIComponent(camChipId)}/roi`,
  )
  return res.data.data
}

export async function saveCamRoiConfig(
  camChipId: string,
  payload: CamRoiConfig,
): Promise<CamRoiConfig> {
  const res = await http.put<CommonResult<CamRoiConfig>>(
    `/admin/device/cam/${encodeURIComponent(camChipId)}/roi`,
    payload,
  )
  return res.data.data
}

export async function getCamPresence(camChipId: string): Promise<CamPresenceState | null> {
  const res = await http.get<CommonResult<CamPresenceState | null>>(
    `/admin/device/cam/${encodeURIComponent(camChipId)}/presence`,
  )
  return res.data.data || null
}

export async function getCamStatus(camChipId: string): Promise<CamStatusState | null> {
  const res = await http.get<CommonResult<CamStatusState | null>>(
    `/admin/device/cam/${encodeURIComponent(camChipId)}/status`,
  )
  return res.data.data || null
}

export async function createCamCaptureTask(
  payload: CamCaptureTaskPayload,
): Promise<CamCaptureTaskResult> {
  const res = await http.post<CommonResult<CamCaptureTaskResult>>(
    '/admin/device/cam/capture-task',
    payload,
  )
  return res.data.data
}

export async function createCamCaptureBatch(
  payload: CamCaptureBatchPayload,
): Promise<CamCaptureBatchResult> {
  const res = await http.post<CommonResult<CamCaptureBatchResult>>(
    '/admin/device/cam/capture-batch',
    payload,
  )
  return res.data.data
}

export async function uploadCamCapturePhoto(
  taskId: string,
  file: File,
): Promise<CamCaptureTaskResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await http.post<CommonResult<CamCaptureTaskResult>>(
    `/admin/device/cam/capture-task/${encodeURIComponent(taskId)}/photo`,
    formData,
  )
  return res.data.data
}

export async function uploadCamFlowPhoto(
  camChipId: string,
  file: File,
  personCount?: number,
  confidence?: number,
): Promise<boolean> {
  const formData = new FormData()
  formData.append('camChipId', camChipId)
  formData.append('file', file)
  if (personCount != null) formData.append('personCount', String(personCount))
  if (confidence != null) formData.append('confidence', String(confidence))
  const res = await http.post<CommonResult<boolean>>('/admin/device/cam/flow-photo', formData)
  return res.data.data
}

export async function setFlowUpload(chipId: string, enabled: boolean): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(
    `/admin/device/flow-upload/${chipId}`,
    {
      enabled,
    }
  )
  return res.data.data
}

export async function locateDevice(chipId: string): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(
    `/admin/device/locate/${chipId}`
  )
  return res.data.data
}

export interface LightEffectPayload {
  effect: 'wave'
  enabled: boolean
  minTemp?: number
  maxTemp?: number
  baseTemp?: number
  range?: number
  amplitude?: number
  speed?: number
  brightness?: number
  phaseIndex?: number
  phaseGap?: number
}

export async function sendLightEffect(
  chipId: string,
  payload: LightEffectPayload,
): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(
    `/admin/device/effect/${chipId}`,
    payload,
  )
  return res.data.data
}

export async function updateFirmwareChannel(
  chipId: string,
  channel: FirmwareChannel,
): Promise<boolean> {
  const res = await http.put<CommonResult<boolean>>(
    `/admin/device/${chipId}/firmware-channel`,
    { channel },
  )
  return res.data.data
}

export async function checkFirmwareUpdate(
  chipId: string,
  channel?: FirmwareChannel,
): Promise<OtaCheckResult> {
  const res = await http.get<CommonResult<OtaCheckResult>>(
    `/admin/device/${chipId}/ota/check`,
    channel ? { params: { channel } } : undefined,
  )
  return res.data.data
}

export async function startOtaUpdate(
  chipId: string,
  firmwareId?: number,
  channel?: FirmwareChannel,
): Promise<OtaCheckResult> {
  const payload: { firmwareId?: number; channel?: FirmwareChannel } = {}
  if (firmwareId) {
    payload.firmwareId = firmwareId
  }
  if (channel) {
    payload.channel = channel
  }

  const res = await http.post<CommonResult<OtaCheckResult>>(
    `/admin/device/${chipId}/ota/update`,
    payload,
  )
  return res.data.data
}

export async function uploadFirmware(formData: FormData): Promise<FirmwareUploadResult> {
  const res = await http.post<CommonResult<FirmwareUploadResult>>(
    '/admin/device/ota/firmware/upload',
    formData,
  )

  if (res.data.code !== 200) {
    throw new Error(res.data.msg || '固件上传失败')
  }

  return res.data.data
}

export async function getFirmwareHistory(params: FirmwareHistoryParams = {}): Promise<FirmwareItem[]> {
  const res = await http.get<CommonResult<FirmwareItem[]>>(
    '/admin/device/ota/firmware/list',
    {
      params: {
        ...(params.deviceType ? { deviceType: params.deviceType } : {}),
        ...(params.channel ? { channel: params.channel } : {}),
      },
    },
  )

  if (res.data.code !== 200) {
    throw new Error(res.data.msg || '固件历史版本加载失败')
  }

  return res.data.data || []
}
