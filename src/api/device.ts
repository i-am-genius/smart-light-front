import http from './http'
import type {
  DeviceCreatePayload,
  DeviceItem,
  DeviceOnlineItem,
  FirmwareHistoryParams,
  FirmwareItem,
  FirmwareUploadResult,
  FirmwareChannel,
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
  id: number,
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

export async function armControl(
  chipId: string,
  action: string,
  speed: ArmControlSpeed = 'normal',
  position?: number,
): Promise<boolean> {
  const payload: { action: string; speed: ArmControlSpeed; position?: number } = {
    action,
    speed,
  }

  if (position !== undefined) {
    payload.position = position
  }

  const res = await http.post<CommonResult<boolean>>(`/admin/device/arm/${chipId}`, payload)
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
