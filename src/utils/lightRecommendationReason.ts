export interface LightRecommendationReasonInput {
  fabric?: string | null
  mainColorRgb?: string | null
  recommendedBrightness?: number | null
  recommendedTemp?: number | null
}

export interface LightRecommendationReason {
  colorTone: string
  fabricFeature: string
  brightnessReason: string
  tempReason: string
  summary: string
}

interface ParsedRgb {
  r: number
  g: number
  b: number
}

const EMPTY_REASON = '完成服装识别后，系统将自动生成照明推荐理由。'

function clampRgb(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function parseMainColorRgb(value?: string | null): ParsedRgb | null {
  const raw = value?.trim()
  if (!raw) return null

  const hexMatch = raw.match(/^#?([a-f\d]{6})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }

  const rgbValues = raw.match(/\d+(?:\.\d+)?/g)
  if (!rgbValues || rgbValues.length < 3) return null

  const [r, g, b] = rgbValues.map(Number)
  if (![r, g, b].every(Number.isFinite)) return null

  return {
    r: clampRgb(r),
    g: clampRgb(g),
    b: clampRgb(b),
  }
}

function buildColorTone(rgb: ParsedRgb | null) {
  if (!rgb) {
    return '当前暂未获取到服装主色，系统会在完成识别后先根据主色深浅和色彩倾向生成基础照明推荐。'
  }

  const { r, g, b } = rgb
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const range = max - min

  const lightnessText = brightness < 85
    ? '主色偏深'
    : brightness > 185
      ? '主色偏浅'
      : '主色明度适中'

  let toneText = '整体接近中性色 / 灰白黑'
  if (range > 18) {
    if (b >= r + 15 && b >= g + 15) {
      toneText = '并呈现冷色系倾向'
    } else if (r >= g + 15 && r >= b + 15) {
      toneText = '并呈现暖色系倾向'
    } else if (g >= r + 12 && g >= b + 12) {
      toneText = '并呈现自然色系倾向'
    }
  }

  return `当前服装${lightnessText}，${toneText}。系统会先以主色作为主要依据计算基础亮度和色温，再结合面料做小幅修正。`
}

function buildFabricFeature(fabric?: string | null) {
  const value = fabric?.trim()
  if (!value) {
    return '暂未获取到明确面料类型，当前推荐主要依据主色生成，暂不进行面料修正。'
  }

  const normalized = value.toLowerCase()
  if (normalized.includes('cotton')) {
    return `识别结果为 ${value}，棉质面料反光较弱，系统会在主色推荐基础上小幅提高亮度，并轻微提高色温，帮助突出纹理和柔和质感。`
  }
  if (normalized.includes('polyester')) {
    return `识别结果为 ${value}，聚酯纤维具有一定反光性，系统会在主色推荐基础上适当降低亮度避免眩光，并略提高色温增强清爽感。`
  }
  if (normalized.includes('wool') || normalized.includes('cashmere')) {
    return `识别结果为 ${value}，羊毛/羊绒类面料质感柔和，系统会在主色推荐基础上略微降低亮度，并采用偏暖或更柔和的色温。`
  }

  return `识别结果为 ${value}，暂未命中特定面料修正规则，系统保持主色基础推荐，避免过度调整展示效果。`
}

function buildBrightnessReason(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '暂未获取到推荐亮度，完成识别后系统会先根据主色计算基础亮度，再按面料特征做小幅修正。'
  }

  if (value < 45) {
    return `系统最终推荐亮度为 ${value}%，当前推荐较低亮度，适合降低能耗并避免过曝。`
  }
  if (value <= 70) {
    return `系统最终推荐亮度为 ${value}%，当前推荐中等亮度，适合兼顾展示效果和节能。`
  }
  return `系统最终推荐亮度为 ${value}%，当前推荐较高亮度，适合深色或低反光面料，增强可见度和层次感。`
}

function buildTempReason(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '暂未获取到推荐色温，完成识别后系统会先根据主色色彩倾向计算基础色温，再按面料特征做小幅修正。'
  }

  if (value < 3500) {
    return `系统最终推荐色温为 ${value}K，属于偏暖色温，适合营造柔和、温暖、高级的展示氛围。`
  }
  if (value <= 5000) {
    return `系统最终推荐色温为 ${value}K，属于中性色温，适合保持颜色还原度，兼顾自然观感和商品细节。`
  }
  return `系统最终推荐色温为 ${value}K，属于偏冷色温，适合突出清爽、明亮、科技感或冷色系服装。`
}

export function generateLightRecommendationReason(
  input: LightRecommendationReasonInput,
): LightRecommendationReason {
  const rgb = parseMainColorRgb(input.mainColorRgb)
  const hasFabric = Boolean(input.fabric?.trim())
  const hasBrightness = typeof input.recommendedBrightness === 'number' && Number.isFinite(input.recommendedBrightness)
  const hasTemp = typeof input.recommendedTemp === 'number' && Number.isFinite(input.recommendedTemp)

  if (!rgb && !hasFabric && !hasBrightness && !hasTemp) {
    return {
      colorTone: EMPTY_REASON,
      fabricFeature: EMPTY_REASON,
      brightnessReason: EMPTY_REASON,
      tempReason: EMPTY_REASON,
      summary: EMPTY_REASON,
    }
  }

  return {
    colorTone: buildColorTone(rgb),
    fabricFeature: buildFabricFeature(input.fabric),
    brightnessReason: buildBrightnessReason(input.recommendedBrightness),
    tempReason: buildTempReason(input.recommendedTemp),
    summary: '该照明参数以服装主色为主要依据，并结合面料反光和质感进行小幅修正，能够兼顾展示效果、视觉舒适度和智能节能控制需求。',
  }
}
