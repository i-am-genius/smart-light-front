export type RgbColor = {
  r: number
  g: number
  b: number
}

export type RefractionSceneMode = 'static' | 'drag'

const LIGHT_STATIC_BASE: RgbColor = { r: 255, g: 255, b: 255 }
const LIGHT_DRAG_BASE: RgbColor = { r: 248, g: 246, b: 243 }
const NIGHT_STATIC_BASE: RgbColor = { r: 15, g: 23, b: 42 }
const NIGHT_DRAG_BASE: RgbColor = { r: 15, g: 23, b: 42 }

export function getRefractionSceneBaseColor(
  night: boolean,
  _verticalRatio = 0,
  mode: RefractionSceneMode = 'static',
): RgbColor {
  if (night) return mode === 'drag' ? NIGHT_DRAG_BASE : NIGHT_STATIC_BASE
  return mode === 'drag' ? LIGHT_DRAG_BASE : LIGHT_STATIC_BASE
}

export function formatRgbColor(color: RgbColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

export function getRelativeLuminance(color: RgbColor): number {
  const toLinear = (value: number) => {
    const channel = value / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  }

  return Number((
    0.2126 * toLinear(color.r) +
    0.7152 * toLinear(color.g) +
    0.0722 * toLinear(color.b)
  ).toFixed(6))
}
