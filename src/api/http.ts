import axios from 'axios'
import { clearAllAuthState, isUnauthenticatedStatus } from '../utils/authStorage'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 10000,
})

interface CommonResultLike {
  code?: number
  msg?: string
  data?: unknown
}

function isCommonResultLike(value: unknown): value is CommonResultLike {
  return Boolean(value && typeof value === 'object' && 'code' in value)
}

function clearAuthStorage() {
  clearAllAuthState(window.localStorage, window.sessionStorage)
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

http.interceptors.request.use((config) => {
  const token =
    window.localStorage.getItem('TOKEN') ||
    window.sessionStorage.getItem('TOKEN')

  config.headers = config.headers || {}

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

http.interceptors.response.use(
  (response) => {
    const result = response.data

    if (isCommonResultLike(result)) {
      const code = Number(result.code)

      if (code !== 200) {
        if (isUnauthenticatedStatus(code)) {
          clearAuthStorage()
          redirectToLogin()
        }

        return Promise.reject(new Error(result.msg || '请求失败'))
      }
    }

    return response
  },
  (error) => {
    console.error('API error:', error)

    if (isUnauthenticatedStatus(error?.response?.status)) {
      clearAuthStorage()
      redirectToLogin()
    }

    const msg =
      error?.response?.data?.msg ||
      error?.response?.data?.message

    if (msg) {
      return Promise.reject(new Error(msg))
    }

    return Promise.reject(error)
  },
)

export default http
