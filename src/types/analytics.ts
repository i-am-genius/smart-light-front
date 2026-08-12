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
  hasData: boolean
  estimated: boolean
  todaySavingRatePercent: number | null
  baselineEnergyKwh: number | null
  smartEnergyKwh: number | null
  savedEnergyKwh: number | null
  lampCount: number | null
  autoDimmingDeviceCount: number | null
  averageBrightnessPercent: number | null
  averageBrightnessReductionPercent: number | null
  dataCoveragePercent: number | null
  ratedPowerWatts: number | null
  operatingHours: number | null
  calculationBasis: string | null
  emptyReason: string | null
}
