/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Return value if it's a finite number, otherwise return fallback. */
export function resolveFiniteNumber(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function optionalFiniteNumber(value: unknown): number | undefined {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return undefined
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

/** Resolve the temperature represented by the layout's current control mode. */
export function resolveDisplayedColorTemperature(
  actualTemp: unknown,
  recommendedTemp: unknown,
  autoMode: boolean,
  fallback = 4000,
): number {
  const actual = optionalFiniteNumber(actualTemp)
  const recommended = optionalFiniteNumber(recommendedTemp)
  const value = autoMode
    ? (recommended ?? actual)
    : actual
  return clamp(value ?? fallback, 2700, 6500)
}

/**
 * Render-compensated display stops for warm-white through cool-white retail lighting.
 * The warm end is intentionally more chromatic so ACES tone mapping and neutral fill
 * do not wash a 2700K spotlight back to near-white on pale garments and walls.
 */
const COLOR_TEMP_STOPS: Array<[number, [number, number, number]]> = [
  [2700, [255, 174, 70]],
  [3500, [255, 207, 137]],
  [4500, [255, 233, 207]],
  [5500, [244, 248, 255]],
  [6500, [226, 237, 255]],
]

/** Convert color temperature (Kelvin) to a hex color string with smooth interpolation. */
export function colorTemperatureToHex(temp: number): string {
  const t = clamp(temp, 2700, 6500)

  for (let i = 0; i < COLOR_TEMP_STOPS.length - 1; i += 1) {
    const [fromTemp, fromColor] = COLOR_TEMP_STOPS[i]
    const [toTemp, toColor] = COLOR_TEMP_STOPS[i + 1]

    if (t <= toTemp) {
      const ratio = (t - fromTemp) / (toTemp - fromTemp)
      const r = Math.round(fromColor[0] + (toColor[0] - fromColor[0]) * ratio)
      const g = Math.round(fromColor[1] + (toColor[1] - fromColor[1]) * ratio)
      const b = Math.round(fromColor[2] + (toColor[2] - fromColor[2]) * ratio)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }
  }

  const [, lastColor] = COLOR_TEMP_STOPS[COLOR_TEMP_STOPS.length - 1]
  return `#${lastColor[0].toString(16).padStart(2, '0')}${lastColor[1].toString(16).padStart(2, '0')}${lastColor[2].toString(16).padStart(2, '0')}`
}

/** Keep bright simulated spots readable without clipping their color temperature to white. */
export function resolveLayoutSpotIntensity(brightness: unknown): number {
  const normalized = clamp(resolveFiniteNumber(brightness, 0), 0, 100) / 100
  return 0.7 + normalized * 9.2
}
