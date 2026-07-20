type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const AUTH_STORAGE_KEYS = ['TOKEN', 'USER_INFO', 'STORE_NAME', 'storeSetup'] as const

export interface AuthState {
  token: string
  userInfo: string
  storeSetup: string
}

function clearAuthState(storage: StorageLike) {
  for (const key of AUTH_STORAGE_KEYS) {
    storage.removeItem(key)
  }
}

export function clearAllAuthState(local: StorageLike, session: StorageLike) {
  clearAuthState(local)
  clearAuthState(session)
}

export function persistAuthState(
  rememberMe: boolean,
  local: StorageLike,
  session: StorageLike,
  state: AuthState,
) {
  const target = rememberMe ? local : session
  const other = rememberMe ? session : local

  clearAuthState(other)
  clearAuthState(target)

  target.setItem('TOKEN', state.token)
  target.setItem('USER_INFO', state.userInfo)
  target.setItem('storeSetup', state.storeSetup)
}

export function isUnauthenticatedStatus(status: unknown) {
  return Number(status) === 401
}
