import http from './http'
import type { LuxRecord } from '../types/lux'

interface CommonResult<T> {
  code: number
  msg: string
  data: T
}

export interface MultiLuxRespVO {
  labels: string[]
  datasets: {
    label: string
    data: Array<number | null>
  }[]
}

export async function getLuxList(chipId: string): Promise<LuxRecord[]> {
  const res = await http.get<CommonResult<LuxRecord[]>>('/admin/lux/list', {
    params: { chipId },
  })
  return res.data.data || []
}

export async function getLatestLux(chipId: string): Promise<LuxRecord | null> {
  const res = await http.get<CommonResult<LuxRecord | null>>('/admin/lux/get-latest', {
    params: { chipId },
  })
  return res.data.data || null
}

export async function getMultiLux(): Promise<MultiLuxRespVO | null> {
  try {
    const res = await http.get<CommonResult<MultiLuxRespVO>>('/admin/lux/multi-trend')
    return res.data.data || null
  } catch (error) {
    console.warn('getMultiLux unavailable:', error)
    return null
  }
}