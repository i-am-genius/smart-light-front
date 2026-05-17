import http from './http'

interface CommonResult<T> {
  code: number
  msg: string
  data: T
}

export interface LightEffectState {
  effect: 'wave' | string
  enabled: boolean
  minTemp?: number
  maxTemp?: number
  baseTemp: number
  range: number
  amplitude?: number
  speed: number
  brightness: number
  phaseIndex: number
  phaseGap: number
  selectedScope: string
  updateTime?: string
}

export type LightEffectStatePayload = Partial<LightEffectState>

export async function getLightEffectState(): Promise<LightEffectState> {
  const res = await http.get<CommonResult<LightEffectState>>('/admin/light-effect/state')
  return res.data.data
}

export async function saveLightEffectState(payload: LightEffectStatePayload): Promise<LightEffectState> {
  const res = await http.post<CommonResult<LightEffectState>>('/admin/light-effect/state', payload)
  return res.data.data
}

export async function closeLightEffectState(): Promise<LightEffectState> {
  const res = await http.post<CommonResult<LightEffectState>>('/admin/light-effect/close')
  return res.data.data
}
