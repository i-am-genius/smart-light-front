import http from './http'

export interface CommonResult<T> {
  code: number
  data: T
  msg: string
}

export interface LoginReq {
  username: string
  password: string
}

export interface RegisterReq {
  username: string
  password: string
  confirmPassword: string
  storeName: string
  storeStyle: string
  area: number
  province: string
  city: string
}

export interface LoginResp {
  token: string
  userId: string
  username: string
  storeId?: string
  storeName?: string
  storeStyle?: string
  province?: string
  city?: string
  storeConfigured?: boolean
}

export function registerApi(data: RegisterReq) {
  return http.post<CommonResult<boolean>>('/api/auth/register', data)
}

export function loginApi(data: LoginReq) {
  return http.post<CommonResult<LoginResp>>('/api/auth/login', data)
}

