import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { CamRoiItem, DeviceItem } from '../src/types/device.ts'
import {
  applyTargetDeviceToRoi,
  getTargetDeviceLabel,
  normalizeCamPreset,
  pickCamRoiFields,
} from '../src/utils/cameraRoi.ts'

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

  it('fills only ROI identity fields from the selected target device', () => {
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

    applyTargetDeviceToRoi(roi, target)

    assert.equal(roi.targetChipId, 'LAMP-002')
    assert.equal(roi.areaName, '新品展示区')
    assert.deepEqual(Object.keys(roi).sort(), [
      'areaName',
      'h',
      'targetChipId',
      'targetIndex',
      'w',
      'x',
      'y',
    ])
  })

  it('migrates legacy preset axes to pan tilt and slider', () => {
    assert.deepEqual(normalizeCamPreset({ yaw: 90, pitch: -5, roll: 120 }), {
      pan: 0,
      tilt: -5,
      slider: 0,
    })
  })

  it('strips legacy ROI tuning and UDP fields before saving', () => {
    const normalized = pickCamRoiFields({
      targetIndex: 1,
      targetChipId: 'LAMP-001',
      areaName: '入口区',
      x: 0.1,
      y: 0.2,
      w: 0.3,
      h: 0.4,
      dwellSeconds: 2,
      leaveDelaySeconds: 3,
      confidenceThreshold: 0.6,
      udpIp: '192.168.1.88',
      udpPort: 4211,
    } as unknown as CamRoiItem)

    assert.deepEqual(Object.keys(normalized).sort(), [
      'areaName',
      'h',
      'targetChipId',
      'targetIndex',
      'w',
      'x',
      'y',
    ])
  })

  it('uses only the simplified ROI controls and new preset names', () => {
    const source = readFileSync(new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url), 'utf8')
    const roiEditor = source.slice(
      source.indexOf('<div class="roi-editor-list">'),
      source.indexOf('<p v-if="roiMessage"'),
    )

    for (const removedText of [
      '目标丢失超时',
      '默认 UDP 端口',
      '中心监测预设',
      '停留秒',
      '离开延迟',
      '置信度',
      'UDP 地址',
      'UDP 端口',
    ]) {
      assert.equal(roiEditor.includes(removedText), false, `still renders removed control: ${removedText}`)
    }
    assert.match(roiEditor, /Pan 水平/)
    assert.match(roiEditor, /Tilt 俯仰/)
    assert.match(roiEditor, /Slider 滑轨/)
    assert.equal(roiEditor.includes('.yaw'), false)
    assert.equal(roiEditor.includes('.pitch'), false)
    assert.equal(roiEditor.includes('.roll'), false)
  })
})
