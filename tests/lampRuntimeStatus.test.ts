import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  garmentDetectionStatusText,
  lampProximityStatusText,
  lampTrackingStatusText,
} from '../src/utils/lampRuntimeStatus.ts'

describe('lamp runtime status text', () => {
  it('maps automatic full-region detection lifecycle', () => {
    assert.equal(garmentDetectionStatusText('not_detected'), '未检测')
    assert.equal(garmentDetectionStatusText('detecting'), '检测中')
    assert.equal(garmentDetectionStatusText('detected'), '已检测')
    assert.equal(garmentDetectionStatusText(undefined), '未检测')
  })

  it('shows proximity as a boolean state without inventing millimetres', () => {
    assert.equal(lampProximityStatusText(false, true), '设备离线')
    assert.equal(lampProximityStatusText(true, undefined), '状态同步中')
    assert.equal(lampProximityStatusText(true, true), '有人靠近')
    assert.equal(lampProximityStatusText(true, false), '无人靠近')
  })

  it('maps the backend tracking lifecycle to the lamp card', () => {
    assert.equal(lampTrackingStatusText('waiting_motion'), '滑轨对位中')
    assert.equal(lampTrackingStatusText('ready'), '准备追踪')
    assert.equal(lampTrackingStatusText('tracking'), '跟随中')
    assert.equal(lampTrackingStatusText('lost'), '目标丢失')
    assert.equal(lampTrackingStatusText('error'), '追踪异常')
    assert.equal(lampTrackingStatusText('monitoring'), '未跟随')
    assert.equal(lampTrackingStatusText(undefined), '未跟随')
  })

  it('uses boolean proximity and backend runtime websocket states end to end', () => {
    const cardSource = readFileSync(
      new URL('../src/components/device/LampDeviceCard.vue', import.meta.url),
      'utf8',
    )
    const dashboardSource = readFileSync(
      new URL('../src/views/SmartLightDashboard.vue', import.meta.url),
      'utf8',
    )

    assert.match(cardSource, /<span>人员靠近<\/span>/)
    assert.doesNotMatch(cardSource, /ToF\s*距离|tofDistanceMm/)
    assert.match(cardSource, /props\.device\.online !== true\) return '未跟随'/)
    assert.match(dashboardSource, /message\.type === 'garmentDetectionStatus'/)
    assert.match(dashboardSource, /message\.type === 'lampProximityState'/)
    assert.doesNotMatch(dashboardSource, /tofDistanceMm/)
  })
})
