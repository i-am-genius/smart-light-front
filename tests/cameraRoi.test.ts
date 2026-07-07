import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CamRoiItem, DeviceItem } from '../src/types/device.ts'
import { applyTargetDeviceToRoi, getTargetDeviceLabel } from '../src/utils/cameraRoi.ts'

describe('camera ROI helpers', () => {
  it('shows the lamp number in target device labels', () => {
    const target: DeviceItem = {
      id: 1,
      chipId: 'LAMP-001',
      displayName: '入口区',
      deviceNo: '3',
      deviceType: 'lamp',
    }

    assert.equal(getTargetDeviceLabel(target, 1), '入口区 · 灯具-3')
  })

  it('fills ROI target fields from the selected target device', () => {
    const roi: CamRoiItem = {
      targetIndex: 1,
      targetChipId: '',
      areaName: '',
      x: 0,
      y: 0,
      w: 0.2,
      h: 0.2,
    }
    const target: DeviceItem = {
      id: 2,
      chipId: 'LAMP-002',
      ip: '192.168.1.88',
      displayName: '新品展示区',
      deviceNo: '8',
      deviceType: 'lamp',
    }

    applyTargetDeviceToRoi(roi, target, 4211)

    assert.equal(roi.targetChipId, 'LAMP-002')
    assert.equal(roi.areaName, '新品展示区')
    assert.equal(roi.udpIp, '192.168.1.88')
    assert.equal(roi.udpPort, 4211)
  })
})
