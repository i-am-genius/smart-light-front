import http from './http'
import type { DurationSummaryItem } from '../types/duration'

interface CommonResult<T> {
  code: number
  msg: string
  data: T
}

export async function getDurationSummary(startDate: string, endDate: string): Promise<DurationSummaryItem[]> {
  const res = await http.get<CommonResult<DurationSummaryItem[]>>('/admin/duration/summary', {
    params: {
      startDate,
      endDate,
    },
  })

  return res.data.data || []
}