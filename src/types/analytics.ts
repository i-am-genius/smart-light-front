export interface TrendPoint {
  timeLabel: string
  value: number
}

export interface TempPeopleTrendData {
  labels: string[]
  tempSeries: number[]
  peopleSeries: number[]
}

export interface StrategyCompareData {
  labels: string[]
  fixedSeries: number[]
  smartSeries: number[]
}