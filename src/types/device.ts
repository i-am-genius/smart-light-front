export type DeviceType = 'lamp' | 'camlamp' | 'cam' | string

export interface DeviceItem {
  id: number
  chipId: string
  displayName?: string
  deviceType?: DeviceType
  deviceNo?: string
  ip?: string
  cameraStreamUrl?: string
  streamUrl?: string
  previewUrl?: string
  brightness?: number
  temp?: number
  autoMode?: boolean
  recommendedBrightness?: number
  recommendedTemp?: number
  fabric?: string
  label?: string
  confidence?: number
  fabricConfidence?: number
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
  lastSeenAt?: string
  firmwareVersion?: string
  firmwareVersionCode?: number
  firmwareChannel?: FirmwareChannel
  otaStatus?: OtaStatus
  otaProgress?: number
  selfTestJson?: string
  selfTestTime?: string
  selfCheckStatus?: string | boolean | number | null
  checkStatus?: string | boolean | number | null
  inspectionStatus?: string | boolean | number | null
  selfTestStatus?: string | boolean | number | null
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
  flowImageName?: string
  camWorkStatus?: CamWorkStatus
  camStatusMessage?: string
  camActiveTargetIndex?: number
  camActiveTargetChipId?: string
  camLastCapture?: CamCaptureTaskResult
  camPresence?: CamPresenceState
  camRoiConfig?: CamRoiConfig
  lampClothState?: LampClothState
  tofDistanceMm?: number
  lastTakenAt?: string | number
  tracking?: boolean
  trackingStatus?: TrackingStatusState
}


export interface DeviceOnlineItem {
  chipId: string
  ip?: string
  online: boolean
  lastSeen?: number
  lastSeenAt?: string
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
  recommendedBrightness?: number
  recommendedTemp?: number
  fabric?: string
  mainColorRgb?: string
}

export type FirmwareChannel = 'stable' | 'test'
export type FirmwareDeviceType = 'lamp' | 'cam' | 'camlamp'

export type OtaStatus = 'idle' | 'updating' | 'success' | 'failed'

export type PtzAxis = 'yaw' | 'pitch' | 'roll' | 'all'
export type PtzDirection = 'left' | 'right' | 'up' | 'down' | 'cw' | 'ccw' | 'center'

export interface CameraPtzPayload {
  chipId: string
  axis?: PtzAxis
  direction?: PtzDirection
  step?: number
  yaw?: number
  pitch?: number
  roll?: number
}

export interface CameraAimTargetPayload {
  camChipId: string
  targetChipId?: string
  targetIndex?: number
}

export type CamWorkStatus =
  | 'monitoring'
  | 'presence'
  | 'capturing'
  | 'uploading'
  | 'returning_center'
  | 'ready_tracking'
  | 'tracking'
  | 'lost'
  | 'offline'
  | 'error'
  | string

export interface CamRoiItem {
  targetIndex: number
  targetChipId?: string
  areaName?: string
  x: number
  y: number
  w: number
  h: number
  dwellSeconds?: number
  leaveDelaySeconds?: number
  confidenceThreshold?: number
  udpIp?: string
  udpPort?: number
}

export interface CamPtzPreset {
  yaw: number
  pitch: number
  roll: number
  configured?: boolean
}

export type CamPresetMap = Record<string, CamPtzPreset>

export interface CamRoiConfig {
  camChipId: string
  configured?: boolean
  centerPreset: CamPtzPreset
  capturePresets: CamPresetMap
  trackingPresets: CamPresetMap
  trackingLostTimeoutSeconds: number
  udpPort: number
  rois: CamRoiItem[]
}

export interface CamPresenceArea {
  targetIndex: number
  targetChipId?: string
  areaName?: string
  present: boolean
  confidence?: number
  dwellSeconds?: number
  updateTime?: string | number
}

export interface CamPresenceState {
  camChipId: string
  workStatus?: CamWorkStatus
  configured?: boolean
  personCount?: number
  confidence?: number
  updateTime?: string | number
  areas: CamPresenceArea[]
}

export interface CamStatusState {
  camChipId: string
  workStatus?: CamWorkStatus
  message?: string
  targetIndex?: number
  targetChipId?: string
  timestamp?: string | number
}

export interface CamCaptureTaskPayload {
  camChipId: string
  targetChipId?: string
  targetIndex?: number
}

export interface CamCaptureTaskResult {
  taskId: string
  camChipId: string
  targetChipId?: string
  targetIndex?: number
  status?: string
  message?: string
  imageName?: string
  photoUrl?: string
  fabric?: string
  label?: string
  confidence?: number
  fabricConfidence?: number
  mainColorRgb?: string
  recommendedBrightness?: number
  recommendedTemp?: number
  clothDetected?: boolean
  clothX?: number
  clothY?: number
  clothW?: number
  clothH?: number
  aiResult?: Partial<DeviceItem>
  fabricResult?: Partial<DeviceItem>
  recognizeResult?: Partial<DeviceItem>
}

export type LampClothStatus = 'on_rack' | 'taken' | 'unknown' | string

export interface LampClothState {
  chipId: string
  clothStatus?: LampClothStatus
  tofDistanceMm?: number
  lastTakenAt?: string | number
  tracking?: boolean
  updateTime?: string | number
}

export interface TrackingStatusState {
  chipId?: string
  camChipId?: string
  targetChipId?: string
  targetIndex?: number
  status?: 'ready' | 'tracking' | 'lost' | 'stopped' | 'timeout' | 'error' | string
  message?: string
  timestamp?: string | number
}

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
