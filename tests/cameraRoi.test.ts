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

  it('uses one slider preset and a dedicated slider lamp binding', () => {
    const source = readFileSync(new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url), 'utf8')
    const globalConfig = source.slice(
      source.indexOf('<div class="roi-editor-item roi-global-config">'),
      source.indexOf('<div class="roi-calibration-layout">'),
    )
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
    assert.match(globalConfig, /滑轨控制灯/)
    assert.match(globalConfig, /roiDraft\.sliderLampChipId/)
    assert.match(globalConfig, /拍照控制器/)
    assert.match(globalConfig, /roiDraft\.captureControllerChipId/)
    assert.equal(roiEditor.includes('拍摄预设'), false)
    assert.equal(roiEditor.includes('追踪预设'), false)
    assert.equal(roiEditor.includes('Pan 水平'), false)
    assert.equal(roiEditor.includes('Tilt 俯仰'), false)
    assert.match(roiEditor, /Slider 滑轨/)
    assert.match(roiEditor, /roiDraft\.sliderPresets\[roi\.targetIndex\]/)
    assert.equal(roiEditor.includes('.yaw'), false)
    assert.equal(roiEditor.includes('.pitch'), false)
    assert.equal(roiEditor.includes('.roll'), false)
    assert.match(source, /waiting_motion: '滑轨对位中'/)
    assert.match(source, /'滑轨控制灯未绑定'/)
    assert.match(source, /'滑轨控制灯离线'/)
  })
})
