import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { CamCaptureTaskResult } from '../src/types/device.ts'
import {
  getCaptureTaskStatusText,
  mergeCaptureTask,
  shortCaptureTaskId,
} from '../src/utils/cameraCaptureTasks.ts'

describe('camera batch capture task state', () => {
  it('upserts websocket task updates and keeps physical sequence order', () => {
    const task2: CamCaptureTaskResult = {
      taskId: 'task-22222222', batchId: 'batch-a', sequence: 2,
      camChipId: 'CAM-001', targetIndex: 1, status: 'queued',
    }
    const task1: CamCaptureTaskResult = {
      taskId: 'task-11111111', batchId: 'batch-a', sequence: 1,
      camChipId: 'CAM-001', targetIndex: 3, status: 'waiting_motion',
    }

    let tasks = mergeCaptureTask([], task2)
    tasks = mergeCaptureTask(tasks, task1)
    tasks = mergeCaptureTask(tasks, { ...task2, status: 'image_received' })

    assert.deepEqual(tasks.map(task => task.taskId), ['task-11111111', 'task-22222222'])
    assert.equal(tasks[1].status, 'image_received')
  })

  it('drops an old batch when the first task of a new batch arrives', () => {
    const oldTask: CamCaptureTaskResult = {
      taskId: 'old-task', batchId: 'batch-old', sequence: 1,
      camChipId: 'CAM-001', status: 'ai_done', createTime: '2026-08-12T10:00:00',
    }
    const nextTask: CamCaptureTaskResult = {
      taskId: 'next-task', batchId: 'batch-new', sequence: 1,
      camChipId: 'CAM-001', status: 'queued', createTime: '2026-08-12T10:01:00',
    }

    assert.deepEqual(mergeCaptureTask([oldTask], nextTask), [nextTask])
  })

  it('ignores late AI updates from an older batch', () => {
    const currentTask: CamCaptureTaskResult = {
      taskId: 'current-task', batchId: 'batch-new', sequence: 1,
      camChipId: 'CAM-001', status: 'capturing', createTime: '2026-08-12T10:01:00',
    }
    const lateOldTask: CamCaptureTaskResult = {
      taskId: 'old-task', batchId: 'batch-old', sequence: 3,
      camChipId: 'CAM-001', status: 'ai_done', createTime: '2026-08-12T10:00:00',
    }

    assert.deepEqual(mergeCaptureTask([currentTask], lateOldTask), [currentTask])
  })

  it('uses the requested Chinese states and compact task ids', () => {
    assert.equal(getCaptureTaskStatusText('image_received'), '收到图片')
    assert.equal(getCaptureTaskStatusText('ai_processing'), 'AI处理中')
    assert.equal(shortCaptureTaskId('12345678-abcd-efgh'), '12345678')
  })

  it('renders the batch trigger and divided task strip in the existing message location', () => {
    const source = readFileSync(
      new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url),
      'utf8',
    )

    assert.match(source, /createCamCaptureBatch/)
    assert.match(source, /class="capture-task-strip"/)
    assert.match(source, /class="capture-task-divider"/)
    assert.match(source, /全区域拍摄/)
  })
})
