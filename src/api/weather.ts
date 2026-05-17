import http from './http'

interface CommonResult<T> {
  code: number
  msg: string
  data: T
}

export interface WeatherCurrent {
  id?: string
  storeId: string
  province?: string
  city?: string
  latitude?: number
  longitude?: number
  temperature?: number
  apparentTemperature?: number
  humidity?: number
  windSpeed?: number
  weatherCode?: number
  weatherText?: string
  tempMax?: number
  tempMin?: number
  collectTime?: string
  createTime?: string
}

export async function getCurrentWeather(storeId: string): Promise<WeatherCurrent> {
  const res = await http.get<CommonResult<WeatherCurrent>>('/admin/weather/current', {
    params: {
      storeId,
    },
  })
  return res.data.data
}
