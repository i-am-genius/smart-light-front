/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Return value if it's a finite number, otherwise return fallback. */
export function resolveFiniteNumber(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

/** 5-stop color temperature stops (Kelvin → [R, G, B]). */
const COLOR_TEMP_STOPS: Array<[number, [number, number, number]]> = [
  [2700, [255, 183, 89]],
  [3500, [255, 214, 150]],
  [4500, [255, 244, 220]],
  [5500, [235, 243, 255]],
  [6500, [210, 228, 255]],
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

  // fallback: highest stop
  const [, lastColor] = COLOR_TEMP_STOPS[COLOR_TEMP_STOPS.length - 1]
  return `#${lastColor[0].toString(16).padStart(2, '0')}${lastColor[1].toString(16).padStart(2, '0')}${lastColor[2].toString(16).padStart(2, '0')}`
}
