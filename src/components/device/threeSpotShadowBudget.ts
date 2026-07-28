export const MAX_SHADOW_CASTING_SPOTS = 4

export type SpotShadowSlot = {
  slotId: string
  order: number
  boundLampDeviceId?: string | number | ''
  sourceDeviceId?: string | number
  deviceId?: string | number
  chipId?: string
  isManual?: boolean
}

function hasDeviceLink(value: string | number | null | undefined) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function isShadowEligible(slot: SpotShadowSlot) {
  return hasDeviceLink(slot.boundLampDeviceId)
    || hasDeviceLink(slot.sourceDeviceId)
    || hasDeviceLink(slot.deviceId)
}

export function selectSpotShadowSlotIds(
  slots: readonly SpotShadowSlot[],
  selectedSlotId: string,
) {
  const eligible = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => isShadowEligible(slot))
    .sort((left, right) => left.slot.order - right.slot.order || left.index - right.index)
    .map(({ slot }) => slot.slotId)

  const selectedIndex = eligible.indexOf(selectedSlotId)
  if (selectedIndex > 0) {
    eligible.unshift(...eligible.splice(selectedIndex, 1))
  }

  return new Set(eligible.slice(0, MAX_SHADOW_CASTING_SPOTS))
}
