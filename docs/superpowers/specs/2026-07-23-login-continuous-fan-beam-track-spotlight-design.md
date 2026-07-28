# Login Continuous Fan Beam And Track Spotlight Design

## Status

Approved interaction direction, pending written-spec review before implementation.

This design supersedes the opening-beam geometry and transition-lamp silhouette in `2026-07-22-login-single-beam-fullscreen-expansion-design.md`. Existing route handoff and Dashboard reveal behavior remain unchanged.

## Problem

The current login transition expands a four-point beam into a viewport-covering polygon. Although it reaches full coverage, the result reads as a staged shape enlargement rather than the same spotlight beam continuously opening like a fan. The simplified transition lamp also lacks the structure and depth of a commercial track spotlight.

## Approved Direction

1. The existing opening beam continuously widens and lengthens until its own boundary passes beyond the complete viewport.
2. Beam geometry has one start state, one full-coverage state, and one continuous easing curve between them. There are no intermediate geometry shapes.
3. Brightness progresses independently from geometry, starting subdued and reaching full intensity only as coverage completes.
4. The lamp uses the selected commercial track-cylinder model: compact adapter, short joint, cylindrical heat-sink body, thick bezel, and recessed emitting lens.
5. The WebGL lamp, CSS fallback lamp, and transition snapshot share the same silhouette.

## Goals

- Make the transition read as one uninterrupted fan opening.
- Cover every viewport pixel with the existing `.beam-aperture` element alone before route handoff.
- Preserve the frozen lamp-to-light direction throughout the transition.
- Replace the bell-shaped lamp with a refined commercial track-cylinder spotlight.
- Prevent a silhouette jump between the live login lamp and its transition snapshot.
- Preserve current authentication, routing, follow motion, responsive layout, backgrounds, and Dashboard behavior.

## Non-Goals

- No auxiliary wash, hotspot, radial mask, circular reveal, rectangular substitute, or viewport-corner morph may produce opening coverage. The existing post-coverage `swap-shield` remains only for route handoff after the beam has already covered the viewport.
- No power cable, hanging cord, visible long rail, or new lamp physics.
- No changes to mouse-follow speed, acceleration, track range, or lamp-angle limits.
- No changes to login, registration, store initialization, or Dashboard layouts.
- No Dashboard reveal redesign in this work.
- No new Three.js scene for the transition overlay.

## Continuous Fan Geometry

### Frozen input

At transition start, freeze the existing normalized snapshot:

- lamp position `L`
- light landing point `T`
- lamp angle
- viewport width and height

Normalize `T - L` into the forward beam axis `u`. Use the perpendicular axis `v` to express viewport corners in beam-local coordinates.

### Shared virtual hinge

The start and end fan polygons use the same virtual hinge `P`. Place `P` behind the lamp along `-u`, outside the viewport plus overscan:

```text
P = L - u * pivotBackward
```

Project all viewport corners relative to `L`. Choose `pivotBackward` so every corner has positive forward depth relative to `P` and the required end slope is no greater than `1.5`. This moves the hinge far enough behind the viewport to prevent enormous clip-path coordinates and an almost-instant jump toward a 90-degree fan. It keeps the visible narrow beam centered through the real lamp.

The hinge is a geometry construction only. The visible lamp does not move to it, and no additional element is rendered there.

### Start fan

The start polygon is a triangle composed of:

1. the shared hinge `P`
2. the right far endpoint at the existing narrow-beam forward distance
3. the left far endpoint at the same distance

Choose the start half-width from the current landing distance and responsive limits, with a fixed `180 px` half-width ceiling for very large displays. Because `P` is behind the lamp, the visible cross-section at the lamp remains narrow while the same two side boundaries pass through the initial landing area.

### Full-coverage fan

For each viewport corner, compute the required beam-local slope from `P` after adding pixel overscan to its perpendicular distance. The end slope is the largest required corner slope, limited to `1.5` by the hinge-depth construction. The end forward depth passes the farthest corner plus the same pixel overscan. This produces a provable normal edge margin of at least `overscan / sqrt(1 + 1.5^2)` rather than an ambiguous angular padding.

At the end forward depth, derive the symmetric far half-width from that half-angle. Clamp the end slope (`farHalfWidth / depthFromHinge`) above the start slope so the fan angle strictly increases even on degenerate viewports. The resulting triangle strictly contains all four viewport corners. Its hinge stays identical to the start triangle; only its two far endpoints move outward and forward.

This construction means the visible side boundaries continuously rotate around one hinge. There is no late near-edge expansion or second geometry mode.

### Degenerate input

- Sanitize non-finite viewport and snapshot values with existing defaults.
- Use a downward axis when lamp and target are coincident.
- Keep all returned coordinates finite on tiny viewports.
- Apply pixel overscan so antialiasing cannot expose edge seams.

## Animation Timeline

Keep the existing total duration and route timing:

- `0 ms`: narrow, low-intensity fan begins opening.
- `0-616 ms`: fan endpoints continuously interpolate from start to full coverage using one nonlinear easing curve.
- `176 ms`: brightness is still restrained.
- `440 ms`: brightness has increased but has not reached full intensity.
- `616 ms`: fan boundary has passed all viewport edges and opacity reaches `1`.
- `616-660 ms`: full-coverage hold before the existing route handoff.
- Later lamp release, overlay fade, and Dashboard behavior remain unchanged.

Geometry and opacity use separate CSS animations. The geometry animation contains only the start polygon and full-coverage polygon, followed by an unchanged hold. Opacity may retain brightness checkpoints because they do not alter `clip-path`.

## Commercial Track-Cylinder Lamp

### Shared silhouette

The live WebGL lamp, CSS fallback, and transition snapshot all include:

- compact rectangular track adapter
- short central swivel joint
- cylindrical metal body
- shallow heat-sink detailing
- thick dark bezel
- recessed warm lens and restrained glow

No cable or rail line is rendered. The lamp remains centered on the existing pose and its emitting lens remains aligned with the beam axis.

### WebGL implementation

Replace the lathed bell shade with primitive geometry attached to the existing `lampRoot`:

- box geometry for the adapter
- short cylinder for the joint
- cylinder geometry for the main body
- thin rings for heat-sink and bezel details
- recessed circle for the emissive lens
- existing glow sprite and point light repositioned at the lens

Reuse the existing renderer, camera, scene, materials lifecycle, pose updates, and disposal arrays. Do not add another render loop or scene.

### CSS fallback and transition snapshot

Use matching structured child elements for adapter, joint, barrel, bezel, and lens. Both variants use the same proportions and material gradients, scaled responsively. The transition snapshot remains a DOM/CSS representation; it does not initialize Three.js.

### Responsive behavior

- Desktop retains current mouse-follow behavior and head-angle interpolation.
- Mobile remains static and defaults to illuminating the form region.
- Mobile scales the complete lamp uniformly; it does not remove structural parts or change the silhouette.

## Integration Boundaries

Allowed production changes:

- `src/components/auth/loginBeamTransition.ts`
- `src/components/auth/LoginBeamTransition.vue`
- `src/components/auth/AuthFollowLight.vue`
- focused tests and Playwright QA scripts for this behavior

Do not change authentication handlers, router guards, Dashboard source, auth page layout, auth page background, follow-light motion equations, or store setup behavior.

## Fallbacks

- If polygon `clip-path` is unsupported, retain the existing opacity-fade transition mode.
- If WebGL initialization fails, show the track-cylinder CSS fallback.
- With reduced motion or on mobile, preserve the existing static lamp behavior; the login transition still completes without requiring pointer movement.

## Test Strategy

### Pure geometry

- End fan contains all four viewport corners on desktop and mobile.
- End fan contains the viewport for left-edge, center, and right-edge lamp snapshots.
- Start and end share exactly one hinge.
- Fan forward depth and half-width increase from start to end.
- End fan slope, and therefore its opening angle, is strictly greater than the start fan slope.
- All values remain finite for coincident targets, invalid ratios, and tiny viewports.

### Component contracts

- Exactly one `.beam-aperture` performs opening illumination.
- No wash, hotspot, radial mask, circular reveal, or rectangular substitute is present.
- The existing `swap-shield` stays transparent until the beam reaches full coverage and is not counted as opening illumination.
- Geometry animation has only start and full-coverage `clip-path` states.
- Brightness keyframes do not introduce intermediate beam polygons.
- The transition snapshot and fallback expose the same track-cylinder parts.
- No cable or long rail element is rendered.

### Integration and visual QA

- Existing login navigation timing and store-setup branch remain unchanged.
- Capture desktop and mobile frames at the opening start, middle, and `616 ms` endpoint.
- Confirm the same two beam edges open continuously with no visible acceleration step or shape switch.
- Confirm all four corners are covered by `616 ms` without overflow or seams.
- Confirm the WebGL lamp, CSS fallback, and transition snapshot have matching proportions and lens alignment.
- Run focused tests, the production build, and `git diff --check`.

## Acceptance Criteria

- The opening reads as one fan continuously widening and lengthening.
- The existing beam alone reaches complete viewport coverage before route handoff.
- No intermediate geometry keyframe is visible or present in the implementation.
- Brightness rises progressively instead of exposing a suddenly bright region.
- The selected commercial track-cylinder lamp is used consistently in live, fallback, and transition states.
- Lamp follow behavior, auth logic, layouts, backgrounds, and Dashboard behavior are unchanged.
