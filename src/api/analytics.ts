import http from './http'
import type { StrategyCompareData, TempPeopleTrendData } from '../types/analytics'

interface CommonResult<T> {
  code: number
  msg: string
  data: T
}

export async function getTempPeopleTrend(chipId?: string): Promise<TempPeopleTrendData | null> {
  try {
    const res = await http.get<CommonResult<TempPeopleTrendData>>('/admin/analytics/temp-people-trend', {
      params: {
        chipId,
      },
    })
    return res.data.data || null
  } catch (error) {
    console.warn('getTempPeopleTrend unavailable:', error)
    return null
  }
}

export async function getStrategyCompare(chipId?: string): Promise<StrategyCompareData | null> {
  try {
    const res = await http.get<CommonResult<StrategyCompareData>>('/admin/analytics/strategy-compare', {
      params: {
        chipId,
      },
    })
    return res.data.data || null
  } catch (error) {
    console.warn('getStrategyCompare unavailable:', error)
    return null
  }
}
