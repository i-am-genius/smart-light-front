import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clearAllAuthState,
  isUnauthenticatedStatus,
  persistAuthState,
} from '../src/utils/authStorage.ts'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

const state = {
  token: 'new-token',
  userInfo: '{"id":1}',
  storeSetup: '{"configured":true}',
}

describe('authentication storage', () => {
  it('clears stale local authentication when session storage is selected', () => {
    const local = createStorage()
    const session = createStorage()
    local.setItem('TOKEN', 'stale-token')
    local.setItem('USER_INFO', 'stale-user')

    persistAuthState(false, local, session, state)

    assert.equal(local.getItem('TOKEN'), null)
    assert.equal(local.getItem('USER_INFO'), null)
    assert.equal(session.getItem('TOKEN'), 'new-token')
  })

  it('clears stale session authentication when local storage is selected', () => {
    const local = createStorage()
    const session = createStorage()
    session.setItem('TOKEN', 'stale-token')

    persistAuthState(true, local, session, state)

    assert.equal(session.getItem('TOKEN'), null)
    assert.equal(local.getItem('TOKEN'), 'new-token')
  })

  it('clears both authentication stores on logout', () => {
    const local = createStorage()
    const session = createStorage()
    local.setItem('TOKEN', 'local-token')
    session.setItem('TOKEN', 'session-token')

    clearAllAuthState(local, session)

    assert.equal(local.getItem('TOKEN'), null)
    assert.equal(session.getItem('TOKEN'), null)
  })

  it('treats 401 as unauthenticated without treating 403 as expired login', () => {
    assert.equal(isUnauthenticatedStatus(401), true)
    assert.equal(isUnauthenticatedStatus(403), false)
  })
})
