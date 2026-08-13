export type GarmentDetectionStatus = 'not_detected' | 'detecting' | 'detected' | string

export function garmentDetectionStatusText(status?: GarmentDetectionStatus): string {
  const normalized = String(status || 'not_detected').trim().toLowerCase()
  if (normalized === 'detecting') return '检测中'
  if (normalized === 'detected') return '已检测'
  return '未检测'
}

export function lampProximityStatusText(online: boolean, nearby?: boolean): string {
  if (!online) return '设备离线'
  if (nearby == null) return '状态同步中'
  return nearby ? '有人靠近' : '无人靠近'
}

export function lampTrackingStatusText(status?: string): string {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'waiting_motion') return '滑轨对位中'
  if (normalized === 'ready' || normalized === 'ready_tracking') return '准备追踪'
  if (normalized === 'tracking') return '跟随中'
  if (normalized === 'lost' || normalized === 'timeout') return '目标丢失'
  if (normalized === 'error') return '追踪异常'
  return '未跟随'
}

