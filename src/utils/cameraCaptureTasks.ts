import type { CamCaptureTaskResult } from '../types/device'

const STATUS_TEXT: Record<string, string> = {
  queued: '等待拍摄',
  waiting_motion: '滑轨对位中',
  capturing: '正在拍摄',
  uploading: '上传中',
  image_received: '收到图片',
  ai_processing: 'AI处理中',
  ai_done: '处理完成',
  photo_saved_ai_failed: 'AI处理失败',
  motion_command_failed: '移动指令失败',
  motion_timeout: '滑轨对位超时',
  camera_offline: '摄像头离线',
  camera_command_failed: '拍照指令失败',
  upload_failed: '上传失败',
  timeout: '拍照超时',
}

export function getCaptureTaskStatusText(status?: string) {
  const normalized = String(status || '').trim().toLowerCase()
  return STATUS_TEXT[normalized] || normalized || '等待拍摄'
}

export function shortCaptureTaskId(taskId?: string) {
  const normalized = String(taskId || '').trim()
  if (!normalized) return '--------'
  return normalized.slice(0, 8)
}

export function mergeCaptureTask(
  current: CamCaptureTaskResult[],
  incoming: CamCaptureTaskResult,
) {
  const batchId = String(incoming.batchId || '').trim()
  const currentBatchId = String(current[0]?.batchId || '').trim()
  if (batchId && currentBatchId && batchId !== currentBatchId) {
    const incomingCreatedAt = Date.parse(String(incoming.createTime || ''))
    const currentCreatedAt = Math.max(
      ...current.map(task => Date.parse(String(task.createTime || '')) || 0),
    )
    if ((incomingCreatedAt || 0) < currentCreatedAt) return current
  }
  const sameBatch = batchId
    ? current.filter(task => String(task.batchId || '').trim() === batchId)
    : current
  const next = sameBatch.filter(task => task.taskId !== incoming.taskId)
  next.push({
    ...sameBatch.find(task => task.taskId === incoming.taskId),
    ...incoming,
  })
  return next.sort((left, right) => {
    const leftSequence = Number(left.sequence) || Number.MAX_SAFE_INTEGER
    const rightSequence = Number(right.sequence) || Number.MAX_SAFE_INTEGER
    if (leftSequence !== rightSequence) return leftSequence - rightSequence
    return (Number(left.targetIndex) || 99) - (Number(right.targetIndex) || 99)
  })
}
