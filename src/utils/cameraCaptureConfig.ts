import type { CamCaptureConfig, CamRoiConfig } from '../types/device'

export function captureConfigToLegacyCameraCard(config: CamCaptureConfig): CamRoiConfig {
  const targets = [1, 2, 3].map(index =>
    config.targets.find(target => Number(target.index) === index) || {
      index,
      lampChipId: '',
      sliderMm: 0,
      moveTimes: { slow: 0, normal: 0, fast: 0 },
    },
  )
  return {
    camChipId: config.camChipId,
    sliderLampChipId: config.sliderLampChipId || '',
    configured: Boolean(config.configured),
    rois: targets.map(target => ({
      targetIndex: target.index,
      targetChipId: target.lampChipId || '',
      areaName: `拍摄目标 ${target.index}`,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    })),
    sliderPresets: Object.fromEntries(targets.map(target => [String(target.index), target.sliderMm || 0])),
    sliderMoveTimes: Object.fromEntries(targets.map(target => [String(target.index), target.moveTimes])),
  }
}
