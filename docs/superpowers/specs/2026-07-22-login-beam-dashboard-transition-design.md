# Login Beam Dashboard Transition Design

## Status

Approved design direction: A, spotlight aperture expansion.

## Goal

After a successful login that is destined for `/smartlightdashboard`, expand the existing authentication spotlight into a full-viewport warm beam that conceals the route swap and reveals the dashboard. The transition must feel continuous with the current pointer-following lamp, complete in about 1.1 seconds, and leave login, store setup, and dashboard business behavior unchanged.

## Confirmed Decisions

- Play the transition only when login would navigate to `/smartlightdashboard`.
- Continue navigating directly to `/store-setup` when `data.storeConfigured === false`.
- Start immediately after the login response and auth persistence succeed; do not show a separate success label or delay.
- Use the full spotlight expansion on desktop, mobile, and reduced-motion environments.
- Use the standard pacing, approximately 1.1 seconds total.
- Use a restrained warm-white peak rather than a pure-white flash.

## Visual Sequence

The transition origin is the lamp's current on-screen position. Because the pointer is normally over the login button when authentication completes, the lamp will usually be near the form center. If no live lamp snapshot is available, use the existing form-centered default.

1. **0-180 ms: charge**
   - Freeze the current lamp position, lamp angle, and light landing point.
   - Increase beam intensity while retaining a narrow cone.
   - Keep the login page fully visible at the start.
2. **180-420 ms: expand**
   - Open the cone outward from the lamp bulb using an accelerating aperture curve.
   - Begin dimming the login form as the warm beam covers it.
3. **At 420 ms: route swap**
   - Run `router.push('/smartlightdashboard')` while the beam is broad and bright enough to conceal the component replacement.
   - Keep the transition overlay mounted above `router-view` so the route swap cannot interrupt it.
4. **420-720 ms: full coverage**
   - Complete the beam expansion across the viewport.
   - Fade the retained lamp silhouette after the original `AuthFollowLight` unmounts.
   - Allow the dashboard to mount beneath the overlay.
5. **720-1100 ms: reveal**
   - Reveal the dashboard outward from the beam origin.
   - Reduce the warm highlight to transparent and release pointer input.

The animation plays once and contains no strobing or repeated brightness pulses.

## Architecture

### `LoginBeamTransition.vue`

Mount one global fixed overlay in `App.vue`, after `router-view`. It owns only transition presentation:

- warm beam and aperture layers;
- a short-lived lamp silhouette matching the accepted auth lamp outline;
- login-page cover and dashboard reveal masks;
- pointer interception while active;
- CSS animation completion reporting.

The overlay must not render or initialize another Three.js scene. CSS gradients, masks, `clip-path`, opacity, and transforms provide the transition.

### Transition Controller

Add a small singleton controller module with two responsibilities:

- record the latest auth-light snapshot without introducing Vue reactivity on every animation frame;
- expose one guarded `playLoginBeamTransition(navigate)` operation for LoginView.

The live snapshot contains normalized viewport coordinates for lamp origin and light landing point, plus lamp angle. Normalized coordinates allow a viewport resize or mobile orientation change during the transition without moving the visual origin off-screen.

At transition start, the controller copies the latest plain snapshot into reactive transition state. Further pointer movement and auth-light updates are ignored until completion.

### `AuthFollowLight.vue`

Keep the current motion kernel, pointer listeners, Three.js scene, light settings, and static-mode behavior unchanged. After applying a rendered lamp/light pose, publish only the latest numeric snapshot to the transition controller.

### `LoginView.vue`

Keep validation, API handling, auth persistence, remembered username behavior, and store-setup branching unchanged.

- When `data.storeConfigured === false`, call the existing direct `router.push('/store-setup')` path.
- Otherwise call the transition controller with a navigation callback for `/smartlightdashboard`.
- Keep the submit button disabled until the transition operation settles so repeated submissions cannot start a second animation.

### `SmartLightDashboard.vue`

No transition-specific code or layout changes. It mounts normally beneath the global overlay and continues its current data-loading sequence.

## Layering And Interaction

- The overlay is `position: fixed`, covers the viewport, and sits above dashboard, auth forms, toasts, dropdowns, and the auth light during the route swap.
- While active it receives pointer events to prevent duplicate clicks and accidental dashboard interaction.
- When inactive it is not rendered and cannot affect hit testing, layout, compositing, or dashboard performance.
- The login page remains responsible for its existing loading state. The transition does not display new copy.

## Responsive Behavior

Desktop and mobile use the same five-phase timeline. Only beam geometry changes:

- desktop expands to cover the wider horizontal radius;
- portrait mobile expands farther vertically and clamps the origin inside the viewport;
- no breakpoint changes, layout changes, or dashboard reflow are introduced.

The full animation also runs when `prefers-reduced-motion: reduce` matches, as explicitly selected. It remains a single non-strobing 1.1-second transition.

## Failure Handling

- Guard against concurrent starts; a second request returns the active transition promise.
- If no light snapshot exists, use the current form-centered default origin.
- If CSS `clip-path` or mask support is unavailable, use a warm opacity fade with the same route timing.
- If presentation setup fails before navigation, clear transition state and navigate immediately.
- If the navigation callback rejects, clear the overlay, release pointer input, and propagate the error to LoginView's existing error path.
- Clear all timers, animation listeners, and pending promise resolvers when the global transition component unmounts.
- Always deactivate the overlay in a final cleanup path so a visual failure cannot trap the user on a blocked screen.

## Testing

### Unit Tests

- Snapshot normalization and default-origin fallback.
- Timeline constants: route swap at 420 ms and completion at 1100 ms.
- Concurrent starts share one active operation.
- Setup failure falls back to immediate navigation.
- Navigation rejection clears transition state and propagates the error.
- Completion and component disposal clear timers and active state.

### Integration Tests

- `App.vue` mounts one global transition overlay.
- `AuthFollowLight.vue` publishes snapshots without changing its motion and cleanup contracts.
- Login triggers the transition only for the dashboard branch.
- The `storeConfigured === false` branch still navigates directly to `/store-setup`.
- No transition-specific code is added to `SmartLightDashboard.vue`.

### Verification

- Run the focused authentication motion and integration tests.
- Run the transition controller tests.
- Run `npm run build`.
- Visually verify the successful dashboard route at `1440x900` and `390x844`.
- Confirm full beam coverage, no horizontal overflow, no visible route-swap frame, and restored pointer interaction after completion.

## Non-Goals

- No transition for registration, store initialization, logout, tab switching, or failed login.
- No changes to auth API calls, storage keys, route guards, dashboard loading, page layout, backgrounds, lamp geometry, spotlight physics, or pointer-follow motion.
- No additional WebGL renderer, animation library, sound, success toast, or user-facing transition setting.
