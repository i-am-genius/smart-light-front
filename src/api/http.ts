import axios from 'axios'

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
  window.localStorage.removeItem('TOKEN')
  window.localStorage.removeItem('USER_INFO')
  window.localStorage.removeItem('STORE_NAME')
  window.localStorage.removeItem('storeSetup')

  window.sessionStorage.removeItem('TOKEN')
  window.sessionStorage.removeItem('USER_INFO')
  window.sessionStorage.removeItem('STORE_NAME')
  window.sessionStorage.removeItem('storeSetup')
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
        if (code === 401) {
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

    if (error?.response?.status === 401) {
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
