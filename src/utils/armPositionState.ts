export type ArmPosition = {
  pan: number
  tilt: number
  slider: number
}

export type ArmDeviceOnlineState = {
  code: string
  online?: boolean
}

export function createZeroArmPosition(): ArmPosition {
  return {
    pan: 0,
    tilt: 0,
    slider: 0,
  }
}

export function readDeviceArmPosition(
  positions: ReadonlyMap<string, ArmPosition>,
  deviceCode: string,
  online?: boolean,
): ArmPosition {
  if (!deviceCode || online === false) {
    return createZeroArmPosition()
  }

  const saved = positions.get(deviceCode)
  return saved ? { ...saved } : createZeroArmPosition()
}

export function saveDeviceArmPosition(
  positions: Map<string, ArmPosition>,
  deviceCode: string,
  position: ArmPosition,
): void {
  if (!deviceCode) return
  positions.set(deviceCode, { ...position })
}

export function clearOfflineArmPositions(
  positions: Map<string, ArmPosition>,
  devices: ArmDeviceOnlineState[],
): string[] {
  const clearedDeviceCodes: string[] = []

  for (const device of devices) {
    if (!device.code || device.online !== false) continue
    positions.delete(device.code)
    clearedDeviceCodes.push(device.code)
  }

  return clearedDeviceCodes
}
