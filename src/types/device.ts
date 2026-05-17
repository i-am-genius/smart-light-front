export interface DeviceItem {
  id: number
  chipId: string
  displayName?: string
  deviceType?: string
  deviceNo?: string
  ip?: string
  brightness?: number
  temp?: number
  autoMode?: boolean
  recommendedBrightness?: number
  recommendedTemp?: number
  fabric?: string
  label?: string
  confidence?: number
  mainColorRgb?: string
  clothDetected?: boolean
  clothX?: number
  clothY?: number
  clothW?: number
  clothH?: number
  originalImageUrl?: string
  annotatedImageUrl?: string
  combinedImageUrl?: string
  createTime?: string
  updateTime?: string
  online?: boolean
  lastSeen?: number
  firmwareVersion?: string
  firmwareVersionCode?: number
  firmwareChannel?: FirmwareChannel
  otaStatus?: OtaStatus
  otaProgress?: number
  personCount?: number
  peopleCount?: number
  flowPersonCount?: number
  personDetected?: boolean
  hasPerson?: boolean
  personDetectTime?: string | number
  flowDetectTime?: string | number
  detectTime?: string | number
  personConfidence?: number
  flowProcessingTime?: number
}


export interface DeviceOnlineItem {
  chipId: string
  ip?: string
  online: boolean
  lastSeen?: number
}

export interface DeviceCreatePayload {
  chipId: string
  ip: string
  displayName?: string
  deviceType?: string
  deviceNo?: string
  brightness?: number
  temp?: number
  autoMode?: boolean
  recommendedBrightness: number
  recommendedTemp: number
  fabric?: string
  mainColorRgb?: string
}

export type FirmwareChannel = 'stable' | 'test'
export type FirmwareDeviceType = 'lamp' | 'cam' | 'camlamp'

export type OtaStatus = 'idle' | 'updating' | 'success' | 'failed'

export interface OtaCheckResult {
  chipId: string
  deviceType?: string
  channel: FirmwareChannel
  currentVersion?: string
  currentVersionCode?: number
  firmwareId?: number
  latestVersion?: string
  latestVersionCode?: number
  fileUrl?: string
  md5?: string
  changelog?: string
  hasUpdate: boolean
  otaStatus?: OtaStatus
}

export interface FirmwareUploadResult {
  id: number
  deviceType: FirmwareDeviceType
  channel: FirmwareChannel
  version: string
  versionCode: number
  fileUrl: string
  md5?: string
  changelog?: string
  enabled: boolean
  createTime?: string
  updateTime?: string
}

export type FirmwareItem = FirmwareUploadResult

export interface FirmwareHistoryParams {
  deviceType?: FirmwareDeviceType | ''
  channel?: FirmwareChannel | ''
}

export type DashboardTab = 'main' | 'flow' | 'settings' | 'firmware'
