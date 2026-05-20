export function normalizeDeviceType(deviceType?: string | null): string {
  return String(deviceType || '').replace(/[-_\s]/g, '').toLowerCase()
}
