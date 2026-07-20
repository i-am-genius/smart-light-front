# Auth Expiry Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return HTTP 401 for unauthenticated REST/WebSocket requests and ensure the frontend keeps exactly one current authentication state before redirecting expired sessions to login.

**Architecture:** Spring Security receives a JSON `AuthenticationEntryPoint` so missing, invalid, and expired JWTs use HTTP 401 before controllers or WebSocket handshake interceptors run; authenticated authorization failures remain HTTP 403. The Vue client centralizes local/session storage operations in a pure utility used by login and Axios, preventing stale tokens from masking a newly issued token.

**Tech Stack:** Java 17, Spring Boot 4.0.5, Spring Security, JUnit 5, MockMvc, Vue 3, TypeScript 6, Axios, Node 24 test runner.

## Global Constraints

- Do not change JWT lifetime or token format.
- Do not change the WebSocket message protocol or `/ws/device` behavior.
- HTTP 401 means unauthenticated; HTTP 403 remains authenticated but unauthorized.
- Preserve unrelated uncommitted changes in both repositories.
- Add no runtime dependency.

---

### Task 1: Backend Unauthenticated Response Contract

**Files:**
- Create: `E:/smart-light-backend/src/main/java/com/genius/smartlight/security/JsonAuthenticationEntryPoint.java`
- Modify: `E:/smart-light-backend/src/main/java/com/genius/smartlight/security/SecurityConfig.java:19-83`
- Create: `E:/smart-light-backend/src/test/java/com/genius/smartlight/security/SecurityAuthenticationEntryPointTest.java`

**Interfaces:**
- Consumes: Spring Security `AuthenticationEntryPoint`, the configured Jackson 2 `ObjectMapper`, and `CommonResult.error(Integer, String)`.
- Produces: `JsonAuthenticationEntryPoint#commence(HttpServletRequest, HttpServletResponse, AuthenticationException)` and HTTP 401 JSON `{ "code": 401, "msg": "登录已失效，请重新登录", "data": null }`.

- [ ] **Step 1: Write the failing security integration tests**

```java
package com.genius.smartlight.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityAuthenticationEntryPointTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void protectedRestRequestWithoutTokenReturnsJson401() throws Exception {
        mockMvc.perform(get("/api/store/current"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void protectedRestRequestWithInvalidTokenReturnsJson401() throws Exception {
        mockMvc.perform(get("/api/store/current")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-valid-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void browserWebSocketWithoutTokenReturns401BeforeHandshake() throws Exception {
        mockMvc.perform(get("/ws"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }
}
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
Set-Location E:/smart-light-backend
./mvnw.cmd -Dtest=SecurityAuthenticationEntryPointTest test
```

Expected: all three assertions receive HTTP 403 instead of 401.

- [ ] **Step 3: Implement the JSON authentication entry point**

```java
package com.genius.smartlight.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genius.smartlight.common.CommonResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(
                response.getWriter(),
                CommonResult.error(401, "登录已失效，请重新登录")
        );
    }
}
```

Inject `JsonAuthenticationEntryPoint` into `SecurityConfig`, then configure it before authorization:

```java
private final JsonAuthenticationEntryPoint jsonAuthenticationEntryPoint;

// In the HttpSecurity chain, after cors(...):
.exceptionHandling(exceptions -> exceptions
        .authenticationEntryPoint(jsonAuthenticationEntryPoint)
)
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
Set-Location E:/smart-light-backend
./mvnw.cmd -Dtest=SecurityAuthenticationEntryPointTest test
```

Expected: 3 tests pass; responses contain JSON business code 401.

- [ ] **Step 5: Run backend regression tests and compile**

Run:

```powershell
Set-Location E:/smart-light-backend
./mvnw.cmd test
./mvnw.cmd compile
```

Expected: Maven exits 0 for both commands.

- [ ] **Step 6: Commit only backend authentication files**

```powershell
Set-Location E:/smart-light-backend
git add -- src/main/java/com/genius/smartlight/security/JsonAuthenticationEntryPoint.java src/main/java/com/genius/smartlight/security/SecurityConfig.java src/test/java/com/genius/smartlight/security/SecurityAuthenticationEntryPointTest.java
git commit -m "fix: return 401 for expired authentication"
```

---

### Task 2: Frontend Single Authentication Storage

**Files:**
- Create: `E:/smart-light-front/src/utils/authStorage.ts`
- Modify: `E:/smart-light-front/src/api/http.ts:1-89`
- Modify: `E:/smart-light-front/src/views/LoginView.vue:55-130`
- Create: `E:/smart-light-front/tests/authStorage.test.ts`

**Interfaces:**
- Consumes: browser-compatible `Storage` objects and the login API result.
- Produces: `persistAuthState(rememberMe, localStorage, sessionStorage, state)`, `clearAllAuthState(localStorage, sessionStorage)`, and `isUnauthenticatedStatus(status)`.

- [ ] **Step 1: Write failing storage and status-classification tests**

```typescript
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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
Set-Location E:/smart-light-front
node --test tests/authStorage.test.ts
```

Expected: FAIL because `src/utils/authStorage.ts` does not exist.

- [ ] **Step 3: Implement the storage utility**

```typescript
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const AUTH_STORAGE_KEYS = ['TOKEN', 'USER_INFO', 'STORE_NAME', 'storeSetup'] as const

export interface AuthState {
  token: string
  userInfo: string
  storeSetup: string
}

function clearAuthState(storage: StorageLike) {
  for (const key of AUTH_STORAGE_KEYS) storage.removeItem(key)
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
```

- [ ] **Step 4: Wire login and Axios to the utility**

In `LoginView.vue`, replace the manual auth storage writes with:

```typescript
persistAuthState(rememberMe.value, localStorage, sessionStorage, {
  token: data.token,
  userInfo: JSON.stringify(data),
  storeSetup: JSON.stringify({
    configured: !!data.storeConfigured,
    skipped: false,
  }),
})
```

In `http.ts`, replace the local duplicated removal function with `clearAllAuthState(window.localStorage, window.sessionStorage)` and guard HTTP/business authentication failures through `isUnauthenticatedStatus(...)`. Keep 403 on the ordinary rejection path.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
Set-Location E:/smart-light-front
node --test tests/authStorage.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Run frontend regression checks**

Run:

```powershell
Set-Location E:/smart-light-front
node --test tests/*.test.ts
npm run build
```

Expected: all Node tests pass and the Vite production build exits 0.

- [ ] **Step 7: Commit only frontend authentication files**

```powershell
Set-Location E:/smart-light-front
git add -- src/utils/authStorage.ts src/api/http.ts src/views/LoginView.vue tests/authStorage.test.ts
git commit -m "fix: replace stale authentication state"
```

---

### Task 3: Cross-Repository Verification

**Files:**
- Verify only; no planned production file changes.

**Interfaces:**
- Consumes: backend HTTP 401 contract and frontend 401 logout behavior.
- Produces: evidence that missing/invalid authentication no longer produces the observed persistent dashboard state.

- [ ] **Step 1: Review scoped diffs without touching unrelated changes**

```powershell
git -C E:/smart-light-backend show --stat --oneline HEAD
git -C E:/smart-light-front show --stat --oneline HEAD
git -C E:/smart-light-backend diff --check HEAD~1..HEAD
git -C E:/smart-light-front diff --check HEAD~1..HEAD
```

Expected: only planned authentication and test files appear in the two implementation commits; no whitespace errors.

- [ ] **Step 2: Re-run focused verification**

```powershell
Set-Location E:/smart-light-backend
./mvnw.cmd -Dtest=SecurityAuthenticationEntryPointTest test
Set-Location E:/smart-light-front
node --test tests/authStorage.test.ts
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Report deployment boundary**

Document that local tests verify the contract, while `api.genius.show` will continue returning the deployed version's 403 until the backend artifact is deployed. Do not claim the production endpoint is fixed before deployment.
