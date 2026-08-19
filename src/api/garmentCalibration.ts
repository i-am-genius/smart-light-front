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
