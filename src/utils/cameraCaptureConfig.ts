import type { CamCaptureConfig, CamRoiConfig } from '../types/device'

export function captureConfigToLegacyCameraCard(config: CamCaptureConfig): CamRoiConfig {
  const targets = [1, 2, 3].map(index =>
    config.targets.find(target => Number(target.index) === index) || {
      index,
      lampChipId: '', areaName: `区域 ${index}`, sliderMm: 0,
      moveTimes: { slow: 0, normal: 0, fast: 0 },
      garmentCapturePan: 90, garmentCaptureTilt: 90,
      personCapturePan: 90, personCaptureTilt: 90,
      collisionParkTimeSeconds: 0,
    },
  )
  return {
    camChipId: config.camChipId,
    sliderLampChipId: config.sliderLampChipId || '',
    captureControllerChipId: config.captureControllerChipId || '',
    flowUploadEnabled: Boolean(config.flowUploadEnabled),
    flowUploadIntervalSeconds: normalizeFlowInterval(config.flowUploadIntervalSeconds),
    configured: Boolean(config.configured),
    rois: targets.map(target => ({
      targetIndex: target.index,
      targetChipId: target.lampChipId || '',
      areaName: target.areaName || `拍摄目标 ${target.index}`,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      garmentCapturePan: normalizeAngle(target.garmentCapturePan),
      garmentCaptureTilt: normalizeAngle(target.garmentCaptureTilt),
      personCapturePan: normalizeAngle(target.personCapturePan),
      personCaptureTilt: normalizeAngle(target.personCaptureTilt),
      collisionParkTimeSeconds: normalizeTime(target.collisionParkTimeSeconds),
    })),
    sliderPresets: Object.fromEntries(targets.map(target => [String(target.index), target.sliderMm || 0])),
    sliderMoveTimes: Object.fromEntries(targets.map(target => [String(target.index), target.moveTimes])),
  }
}

export function legacyCameraCardToCaptureConfig(
  camChipId: string,
  config: CamRoiConfig,
): CamCaptureConfig {
  const fallbackGarmentPan = normalizeAngle(config.garmentCapturePan ?? config.capturePan)
  const fallbackGarmentTilt = normalizeAngle(config.garmentCaptureTilt ?? config.captureTilt)
  const fallbackPersonPan = normalizeAngle(config.personCapturePan)
  const fallbackPersonTilt = normalizeAngle(config.personCaptureTilt)
  const targets = [1, 2, 3].map(index => {
    const roi = config.rois.find(item => Number(item.targetIndex) === index)
    return {
      index,
      lampChipId: roi?.targetChipId || '',
      areaName: roi?.areaName || `拍摄目标 ${index}`,
      sliderMm: normalizeSlider(config.sliderPresets?.[String(index)]),
      moveTimes: {
        slow: normalizeTime(config.sliderMoveTimes?.[String(index)]?.slow),
        normal: normalizeTime(config.sliderMoveTimes?.[String(index)]?.normal),
        fast: normalizeTime(config.sliderMoveTimes?.[String(index)]?.fast),
      },
      garmentCapturePan: normalizeAngle(roi?.garmentCapturePan ?? fallbackGarmentPan),
      garmentCaptureTilt: normalizeAngle(roi?.garmentCaptureTilt ?? fallbackGarmentTilt),
      personCapturePan: normalizeAngle(roi?.personCapturePan ?? fallbackPersonPan),
      personCaptureTilt: normalizeAngle(roi?.personCaptureTilt ?? fallbackPersonTilt),
      collisionParkTimeSeconds: normalizeTime(roi?.collisionParkTimeSeconds),
    }
  })
  return {
    camChipId,
    sliderLampChipId: String(config.sliderLampChipId || '').trim(),
    captureControllerChipId: String(config.captureControllerChipId || '').trim(),
    flowUploadEnabled: Boolean(config.flowUploadEnabled),
    flowUploadIntervalSeconds: normalizeFlowInterval(config.flowUploadIntervalSeconds),
    configured: targets.every(target => Boolean(target.lampChipId)),
    targets,
  }
}

function normalizeAngle(value: unknown) {
  const numeric = value == null || value === '' ? 90 : Number(value)
  return Math.round(Math.max(0, Math.min(180, Number.isFinite(numeric) ? numeric : 90)))
}

function normalizeSlider(value: unknown) {
  const numeric = Number(value)
  return Math.round(Math.max(0, Math.min(2500, Number.isFinite(numeric) ? numeric : 0)))
}

function normalizeTime(value: unknown) {
  const numeric = Number(value)
  const clamped = Math.max(0, Math.min(3600, Number.isFinite(numeric) ? numeric : 0))
  return Math.round(clamped * 1000) / 1000
}

function normalizeFlowInterval(value: unknown) {
  const numeric = value == null || value === '' ? 30 : Number(value)
  return Math.round(Math.max(5, Math.min(3600, Number.isFinite(numeric) ? numeric : 30)))
}
