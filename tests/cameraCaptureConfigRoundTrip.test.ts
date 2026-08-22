import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  captureConfigToLegacyCameraCard,
  legacyCameraCardToCaptureConfig,
} from '../src/utils/cameraCaptureConfig.ts'

describe('camera capture config compatibility', () => {
  it('preserves controller binding, poses, flow upload and collision timing', () => {
    const input = {
      camChipId: 'CAM-001',
      sliderLampChipId: 'LAMP-001',
      captureControllerChipId: 'CAPTURE-001',
      flowUploadEnabled: true,
      flowUploadIntervalSeconds: 45,
      configured: true,
      targets: [1, 2, 3].map(index => ({
        index,
        lampChipId: `LAMP-00${index}`,
        areaName: `目标 ${index}`,
        sliderMm: index * 500,
        moveTimes: { slow: 20, normal: 10, fast: 5 },
        garmentCapturePan: 80 + index,
        garmentCaptureTilt: 90 + index,
        personCapturePan: 100 + index,
        personCaptureTilt: 110 + index,
        collisionParkTimeSeconds: index / 10,
      })),
    }

    const legacy = captureConfigToLegacyCameraCard(input)
    const output = legacyCameraCardToCaptureConfig(input.camChipId, legacy)

    assert.equal(output.captureControllerChipId, 'CAPTURE-001')
    assert.equal(output.flowUploadEnabled, true)
    assert.equal(output.flowUploadIntervalSeconds, 45)
    assert.equal(output.targets[0]?.garmentCapturePan, 81)
    assert.equal(output.targets[0]?.personCaptureTilt, 111)
    assert.equal(output.targets[2]?.collisionParkTimeSeconds, 0.3)
  })
})
