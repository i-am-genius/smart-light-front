import http from './http'
import type {
  GarmentAimCalibrationSamplePayload,
  GarmentAimCalibrationStatus,
} from '../types/device'

interface CommonResult<T> {
  code: number
  msg: string
  data: T
}

export type GarmentCaptureSourceKey = 'PHONE' | `CAMERA:${string}`

export interface SourceAwareGarmentAimCalibrationStatus extends GarmentAimCalibrationStatus {
  sourceKey: GarmentCaptureSourceKey
  legacyMigrationRequired?: boolean
  legacySampleCount?: number
}

export interface CopyGarmentAimCalibrationPayload {
  sourceKey: GarmentCaptureSourceKey
  targetLampChipIds: string[]
  overwrite?: boolean
}

export function phoneSourceKey(): GarmentCaptureSourceKey {
  return 'PHONE'
}

export function cameraSourceKey(camChipId: string): GarmentCaptureSourceKey {
  return `CAMERA:${camChipId}`
}

export function createCaptureLightingSessionId(prefix = 'PHONE'): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}:${uuid}`
}

export async function getSourceGarmentAimCalibration(
  lampChipId: string,
  sourceKey: GarmentCaptureSourceKey,
): Promise<SourceAwareGarmentAimCalibrationStatus> {
  const res = await http.get<CommonResult<SourceAwareGarmentAimCalibrationStatus>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/garment-aim-calibration`,
    { params: { sourceKey } },
  )
  return res.data.data
}

export async function addSourceGarmentAimCalibrationSample(
  lampChipId: string,
  sourceKey: GarmentCaptureSourceKey,
  payload: GarmentAimCalibrationSamplePayload,
): Promise<SourceAwareGarmentAimCalibrationStatus> {
  const res = await http.post<CommonResult<SourceAwareGarmentAimCalibrationStatus>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/garment-aim-calibration/samples`,
    payload,
    { params: { sourceKey } },
  )
  return res.data.data
}

export async function clearSourceGarmentAimCalibration(
  lampChipId: string,
  sourceKey: GarmentCaptureSourceKey,
): Promise<SourceAwareGarmentAimCalibrationStatus> {
  const res = await http.delete<CommonResult<SourceAwareGarmentAimCalibrationStatus>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/garment-aim-calibration`,
    { params: { sourceKey } },
  )
  return res.data.data
}

export async function migrateLegacyGarmentAimCalibration(
  lampChipId: string,
  sourceKey: GarmentCaptureSourceKey,
): Promise<SourceAwareGarmentAimCalibrationStatus> {
  const res = await http.post<CommonResult<SourceAwareGarmentAimCalibrationStatus>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/garment-aim-calibration/migrate-legacy`,
    { sourceKey },
  )
  return res.data.data
}

export async function copyGarmentAimCalibration(
  lampChipId: string,
  payload: CopyGarmentAimCalibrationPayload,
): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/garment-aim-calibration/copy`,
    payload,
  )
  return res.data.data
}

export async function startCaptureLighting(
  lampChipId: string,
  sessionId?: string,
): Promise<string> {
  const requestedSessionId = sessionId || createCaptureLightingSessionId('PHONE')
  try {
    const res = await http.post<CommonResult<string>>(
      `/admin/device/lamp/${encodeURIComponent(lampChipId)}/capture-lighting/start`,
      undefined,
      { params: { sessionId: requestedSessionId } },
    )
    return res.data.data || requestedSessionId
  } catch (error) {
    try {
      await stopCaptureLighting(lampChipId, requestedSessionId)
    } catch (stopError) {
      console.warn('[capture-lighting] cleanup after start failure failed', stopError)
    }
    throw error
  }
}

export async function stopCaptureLighting(
  lampChipId: string,
  sessionId: string,
): Promise<boolean> {
  const res = await http.post<CommonResult<boolean>>(
    `/admin/device/lamp/${encodeURIComponent(lampChipId)}/capture-lighting/stop`,
    undefined,
    { params: { sessionId } },
  )
  return res.data.data
}
