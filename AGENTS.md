# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check (vue-tsc) then build for production
npm run preview      # Preview production build
```

## Architecture

Vue 3 + TypeScript + Vite SPA. Capacitor wrapper for Android. Pinia for state (minimally used), vue-router for routing.

### Routing & Auth Guard

`src/router/index.ts` — beforeEach guard checks localStorage/sessionStorage for JWT token and store setup state. Unauthenticated users redirect to `/login`. Users with token but no store config redirect to `/store-setup`.

### Key Pages

- **SmartLightDashboard** — Main app shell with tabbed navigation (main/flow/settings/firmware). Contains real-time device control, weather display, store layout editor, and all settings panels.
- **LoginView / RegisterView** — Auth pages with sidebar brand info + form card layout.
- **StoreSetup** — Post-registration store configuration (name, area, city, style).

### WebSocket

`src/composables/useWebSocket.ts` — Auto-reconnecting WebSocket with JWT protocol auth. SmartLightDashboard handles these message types: `state`, `lightEffectState`, `onlineStatus`, `fabricRecognize`, `deviceDeleted`, `personDetection`, `durationUpdate`, `lux`, `announce`.

### API Layer

`src/api/` — Axios-based HTTP clients. All requests go through `http.ts` which attaches JWT token from localStorage/sessionStorage. Response wrapper is `CommonResult<T>` with `code`, `msg`, `data`.

### Key Composables

- `src/composables/useClock.ts` — Reactive clock (currentTime, dateInfo, weekInfo)
- `src/composables/useWebSocket.ts` — WS connection with auto-reconnect
- `src/composables/useToast.ts` — Global toast notifications (Teleport to body)
- `src/composables/useShake.ts` — Form validation shake animation trigger

### Runtime Type Quirk

`DeviceItem.id` is typed as `number` but runtime values from the API/WS are strings. Always use `String(id)` for comparisons to avoid `===` mismatches.

### CSS

- `src/style.css` — Global styles (grid layouts, night mode overrides, responsive breakpoints)
- Components use `<style scoped>` with `:deep()` for child penetration and `:global(.night-mode)` for dark theme
- Night mode is driven by `.app-container.night-mode` class on the root element
- Mobile breakpoint: `@media (max-width: 768px)`. Tablet: `@media (max-width: 960px)`.

### Related Repos

- `E:\smart-light-backend` — Spring Boot backend
- `E:\smart-light-mini` — ESP8266 firmware (light controller)
- `E:\8266_OTA` — ESP8266 OTA firmware
