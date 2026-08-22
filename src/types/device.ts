export type GarmentPosition = 'upper' | 'lower' | 'fullBody'
export type GarmentCategory = 'upper' | 'pants' | 'skirt' | 'dress'
export type OutfitType = 'upper_only' | 'lower_only' | 'separates' | 'dress'

export interface GarmentPart {
  position: GarmentPosition
  category: GarmentCategory
  categoryConfidence?: number | null
  fabric: string
  fabricConfidence?: number
  mainColorRgb: string
  maskArea: number
  x?: number
  y?: number
  w?: number
  h?: number
}

export interface GarmentState {
  resultVersion?: number
  clothDetected?: boolean
  segmentationFallback?: boolean
  outfitType?: OutfitType
  garments: GarmentPart[]
}

export type DeviceType = 'lamp' | 'camlamp' | 'cam' | string
export type GarmentDetectionStatus = 'not_detected' | 'detecting' | 'detected' | string

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
  garmentAimEnabled?: boolean
  garmentDefaultPan?: number
  garmentDefaultTilt?: number
  personDefaultPan?: number
  personDefaultTilt?: number
  recommendedBrightness?: number
  recommendedTemp?: number
  fabric?: string
  label?: string
  confidence?: number
  fabricConfidence?: number
  mainColorRgb?: string
  resultVersion?: number
  segmentationFallback?: boolean
  outfitType?: OutfitType
  garments?: GarmentPart[]
  clothDetected?: boolean
  clothX?: number
  clothY?: number
  clothW?: number
  clothH?: number
  imageWidth?: number
  imageHeight?: number
  originalImageUrl?: string
  annotatedImageUrl?: string
  annotatedImageBlobUrl?: string
  annotatedImageId?: string
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
  camCaptureTasks?: CamCaptureTaskResult[]
  camPresence?: CamPresenceState
  camCaptureConfig?: CamCaptureConfig
  /** @deprecated Internal adapter only while CameraDeviceCard is decomposed. */
  camRoiConfig?: CamRoiConfig
  lampClothState?: LampClothState
  lampProximityState?: LampProximityState
  garmentDetectionStatus?: GarmentDetectionStatus
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
  garmentDetectionStatus?: GarmentDetectionStatus
  nearby?: boolean
  lastTakenAt?: string | number
  trackingStatus?: string
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
  garmentAimEnabled?: boolean
  garmentDefaultPan?: number
  garmentDefaultTilt?: number
  personDefaultPan?: number
  personDefaultTilt?: number
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

export interface CamTrackingControlPayload {
  camChipId: string
  targetChipId: string
  targetIndex: number
}

export interface CamGlobalTrackingControlPayload {
  camChipId: string
}

export interface CamTrackingControlResult {
  chipId?: string
  role?: string
  trackingStatus: string
  trackingMode?: 'single' | 'global' | string
  sessionId?: string
  camChipId?: string
  lampChipId?: string
  targetIndex?: number
  targetChipIds?: string[]
  message?: string
  updateTime?: string | number
}

export type CamWorkStatus =
  | 'monitoring'
  | 'presence'
  | 'waiting_motion'
  | 'capturing'
  | 'uploading'
  | 'returning_center'
  | 'ready_tracking'
  | 'tracking'
  | 'lost'
  | 'offline'
  | 'error'
  | string

export interface CamPtzPreset {
  pan: number
  tilt: number
  slider: number
}

export interface CamSliderMoveTimes {
  slow: number
  normal: number
  fast: number
}

export interface CamCaptureTargetConfig {
  index: number
  lampChipId?: string
  sliderMm: number
  moveTimes: CamSliderMoveTimes
}

export interface CamCaptureConfig {
  camChipId: string
  sliderLampChipId?: string
  configured?: boolean
  targets: CamCaptureTargetConfig[]
}

/** @deprecated Spatial ROI is no longer part of the product model. */
export interface CamRoiItem {
  targetIndex: number
  targetChipId?: string
  areaName?: string
  x: number
  y: number
  w: number
  h: number
}

/** @deprecated Internal compatibility shape for the legacy Camera card only. */
export interface CamRoiConfig {
  camChipId: string
  sliderLampChipId?: string
  rois: CamRoiItem[]
  sliderPresets: Record<string, number>
  sliderMoveTimes: Record<string, CamSliderMoveTimes>
  configured?: boolean
}

/** @deprecated Camera area presence is synthesized from per-Lamp ToF. */
export interface CamPresenceArea {
  targetIndex: number
  targetChipId?: string
  areaName?: string
  present?: boolean
  confidence?: number
  dwellSeconds?: number
  updateTime?: string | number
}

export interface CamPresenceState {
  camChipId: string
  workStatus?: CamWorkStatus
  personCount?: number
  confidence?: number
  updateTime?: string | number
  /** @deprecated Internal UI adapter only; backend no longer accepts ROI areas. */
  areas?: CamPresenceArea[]
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

export interface CamCaptureBatchPayload {
  camChipId: string
}

export interface CamCaptureBatchResult {
  batchId: string
  camChipId: string
  status?: string
  message?: string
  tasks: CamCaptureTaskResult[]
  createTime?: string
}

export interface CamCaptureTaskResult {
  taskId: string
  batchId?: string
  sequence?: number
  createTime?: string
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
  resultVersion?: number
  segmentationFallback?: boolean
  outfitType?: OutfitType
  garments?: GarmentPart[]
  recommendedBrightness?: number
  recommendedTemp?: number
  clothDetected?: boolean
  clothX?: number
  clothY?: number
  clothW?: number
  clothH?: number
  imageWidth?: number
  imageHeight?: number
  aiResult?: Partial<DeviceItem>
  fabricResult?: Partial<DeviceItem>
  recognizeResult?: Partial<DeviceItem>
}

export type LampClothStatus = 'on_rack' | 'taken' | 'unknown' | string

export interface LampClothState {
  chipId: string
  clothStatus?: LampClothStatus
  clothState?: LampClothStatus
  lastTakenAt?: string | number
  tracking?: boolean
  updateTime?: string | number
}

export interface LampProximityState {
  chipId: string
  nearby?: boolean
  updateTime?: string | number
}

export interface TrackingStatusState {
  chipId?: string
  sessionId?: string
  trackingMode?: 'single' | 'global' | string
  camChipId?: string
  lampChipId?: string
  targetChipId?: string
  targetIndex?: number
  targetChipIds?: string[]
  status?: 'armed' | 'ready' | 'tracking' | 'lost' | 'stopped' | 'monitoring' | 'timeout' | 'error' | string
  message?: string
  timestamp?: string | number
}

export interface GarmentAimCalibrationSample {
  id: string
  centerX: number
  centerY: number
  pan: number
  tilt: number
  recognizedAt?: string
  createdAt?: string
}

export interface GarmentAimCalibrationStatus {
  lampChipId: string
  sampleCount: number
  minimumSampleCount: number
  recommendedSampleCount: number
  modelReady: boolean
  statusCode: string
  statusMessage: string
  horizontalCoverage: number
  verticalCoverage: number
  rmsePan?: number
  rmseTilt?: number
  currentTargetValid: boolean
  currentTargetSampled: boolean
  currentCenterX?: number
  currentCenterY?: number
  currentRecognizedAt?: string
  suggestedPan?: number
  suggestedTilt?: number
  suggestionSource?: 'calibrated' | 'default' | string
  updatedAt?: string
  samples: GarmentAimCalibrationSample[]
}

export interface GarmentAimCalibrationSamplePayload {
  pan: number
  tilt: number
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
