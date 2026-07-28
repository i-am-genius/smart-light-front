# Login Beam Dashboard Transition Design

## Status

Approved design direction: A, trapezoid-to-viewport beam morph with a four-edge rectangular reveal.

## Goal

After a successful login that is destined for `/smartlightdashboard`, zoom the existing authentication spotlight from a dim, narrow beam into full-viewport warm illumination. Only after all four viewport corners are covered may the route swap occur; the dashboard then reveals outward from the frozen light landing point. The transition must feel continuous with the current pointer-following lamp, complete in about 1.1 seconds, and leave login, store setup, and dashboard business behavior unchanged.

## Confirmed Decisions

- Play the transition only when login would navigate to `/smartlightdashboard`.
- Continue navigating directly to `/store-setup` when `data.storeConfigured === false`.
- Start immediately after the login response and auth persistence succeed; do not show a separate success label or delay.
- Use the full spotlight expansion on desktop, mobile, and reduced-motion environments.
- Use the standard pacing, approximately 1.1 seconds total.
- Use a restrained warm-white peak rather than a pure-white flash.
- Start at low intensity and increase brightness continuously with the beam's coverage; do not jump near peak brightness during the opening frames.
- Reach complete viewport coverage before changing routes.
- Reveal the dashboard from the same frozen `lightX`/`lightY` landing point used by the expanding spotlight.
- Keep the full-bright hold brief: the dashboard reveal follows the route swap without a separate pause.
- Do not use a circular hotspot, circular iris, radial reveal, or rounded aperture. The approved A direction is a trapezoid-to-rectangle spotlight zoom followed by a four-edge rectangular dashboard opening.

## Visual Sequence

The transition preserves two related origins. The beam cone opens from the lamp pivot (`lampX`/`lampY`), while the illumination spread and dashboard reveal share the frozen light landing point (`lightX`/`lightY`). Because the pointer is normally over the login button when authentication completes, the landing point will usually be near the form center. If no live lamp snapshot is available, use the existing form-centered default.

1. **0-176 ms: low-intensity focus**
   - Freeze the current lamp position, lamp angle, and light landing point.
   - Retain a narrow cone and increase intensity only slightly from a low visible starting level.
   - Keep the login page fully visible at the start.
2. **176-616 ms: spotlight zoom**
   - Open the directional cone outward from the lamp pivot using an accelerating aperture curve.
   - Expand a four-point trapezoid along the lamp-to-landing-point axis; morph its four vertices into the exact viewport corners at 616 ms.
   - Increase brightness monotonically with the covered area so the login page changes progressively rather than flashing.
   - End with the warm beam covering the entire viewport, including all four corners.
3. **616-660 ms: complete warm coverage**
   - Hold the restrained warm-white peak only long enough to guarantee there is no uncovered route-swap frame.
   - Keep the login route active throughout this coverage milestone.
4. **At 660 ms: route swap**
   - Run `router.push('/smartlightdashboard')` only after full viewport coverage has been reached.
   - Keep the transition overlay mounted above `router-view` so the route swap cannot interrupt it.
5. **660-704 ms: dashboard mount**
   - Fade the retained lamp silhouette after the original `AuthFollowLight` unmounts.
   - Allow the dashboard to mount beneath the fully opaque warm cover.
6. **704-1100 ms: dashboard reveal**
   - Reveal the dashboard as a rectangular opening whose initial zero-area point is the frozen `lightX`/`lightY` landing point.
   - Move four opaque warm panels independently toward the top, bottom, left, and right viewport edges. This expands the opening without scaling or deforming dashboard content.
   - Keep adjacent panels overlapped by one pixel and feather only their moving inner edges so the rectangular opening has no seams or hard circular outline.
   - Reduce the warm highlight to transparent and release pointer input.

The animation plays once and contains no strobing or repeated brightness pulses.

## Architecture

### `LoginBeamTransition.vue`

Mount one global fixed overlay in `App.vue`, after `router-view`. It owns only transition presentation:

- a directional cone and four-point beam wash whose aperture and intensity rise together;
- a short-lived lamp silhouette matching the accepted auth lamp outline;
- a fully opaque route-swap shield and a separate four-panel dashboard reveal curtain;
- a guaranteed full-coverage handoff before the route swap;
- pointer interception while active;
- CSS animation completion reporting.

The overlay must not render or initialize another Three.js scene. CSS linear gradients, `clip-path`, opacity, and transforms provide the transition. Circular and radial masks are explicitly excluded.

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

- desktop and mobile both finish at the exact viewport bounds so all four corners are covered before navigation;
- portrait mobile retains the same four-edge landing-point reveal and clamps the recorded origin inside the viewport;
- no breakpoint changes, layout changes, or dashboard reflow are introduced.

The full animation also runs when `prefers-reduced-motion: reduce` matches, as explicitly selected. It remains a single non-strobing 1.1-second transition.

## Failure Handling

- Guard against concurrent starts; a second request returns the active transition promise.
- If no light snapshot exists, use the current form-centered default origin.
- If CSS polygon `clip-path` support is unavailable, use a warm opacity fade that reaches full coverage before the same 660 ms route timing.
- If presentation setup fails before navigation, clear transition state and navigate immediately.
- If the navigation callback rejects, clear the overlay, release pointer input, and propagate the error to LoginView's existing error path.
- Clear all timers, animation listeners, and pending promise resolvers when the global transition component unmounts.
- Always deactivate the overlay in a final cleanup path so a visual failure cannot trap the user on a blocked screen.

## Testing

### Unit Tests

- Snapshot normalization and default-origin fallback.
- Timeline constants: complete coverage by 616 ms, route swap at 660 ms, reveal start at 704 ms, and completion at 1100 ms.
- Initial beam intensity remains low and brightness increases with each aperture stage until full coverage.
- Route navigation never occurs before the full-viewport beam keyframe.
- The trapezoid reaches `polygon(0 0, 100% 0, 100% 100%, 0 100%)` before navigation.
- Dashboard reveal uses four rectangular panels whose inner edges begin at the frozen normalized `lightX`/`lightY` snapshot and move to the viewport edges.
- Transition lighting and reveal layers contain no circular hotspot, radial gradient, radial mask, or rounded aperture.
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
- Confirm low initial intensity, progressive trapezoid expansion, full four-corner coverage before navigation, a same-origin rectangular dashboard reveal, no circular edge, no horizontal overflow, no visible route-swap frame, and restored pointer interaction after completion.

## Non-Goals

- No transition for registration, store initialization, logout, tab switching, or failed login.
- No changes to auth API calls, storage keys, route guards, dashboard loading, page layout, backgrounds, lamp geometry, spotlight physics, or pointer-follow motion.
- No additional WebGL renderer, animation library, sound, success toast, or user-facing transition setting.
