# Login Single-Beam Fullscreen Expansion Design

## Status

Approved visual direction. This document replaces the previously proposed trapezoid-to-viewport-corners wash for the opening phase of the login transition.

## Goal

After successful login, expand the existing directional spotlight itself until its visible boundary naturally passes beyond the entire viewport. The effect must continue to read as the same beam emitted by the frozen lamp: its axis stays fixed, its length and opening width grow continuously, and its brightness rises with coverage.

This phase must not be simulated by another wash, a circular hotspot, a screen-shaped polygon, a radial mask, or a full-screen opacity layer. Dashboard reveal behavior is intentionally outside this design and will be handled separately.

## Confirmed Decisions

- Keep the existing lamp snapshot, frozen lamp pivot, frozen light landing point, and lamp-to-light beam axis.
- Render the opening illumination with the existing `.beam-aperture` element only.
- Increase that beam's forward length, backward reach, near width, and far width continuously.
- Allow the same beam to extend behind the lamp late in the animation so it can cover the strip of viewport above an in-viewport lamp pivot.
- Keep the lamp model above the beam. It hides the small backward-growing section around the lamp mouth, preserving the impression that the light originates from the fixture.
- Calculate the final beam bounds from the current viewport and frozen lamp pose. Do not use a fixed desktop-only oversize value as the coverage guarantee.
- Make the final beam polygon overshoot the viewport rather than ending on its four corners.
- Do not add or retain `.beam-wash`, `.beam-hotspot`, circular gradients, radial masks, screen-corner morphing, or another visual layer that substitutes for beam coverage.
- Keep authentication behavior, persistence, route guards, page layout, backgrounds, lamp model, pointer-follow motion, and Dashboard code unchanged.

## Considered Approaches

### 1. Dynamic beam-local overscan (selected)

Transform the four viewport corners into coordinates relative to the frozen beam axis. Use their longitudinal and perpendicular extents to calculate a final, slightly tapered beam polygon whose four edges lie beyond the viewport by a small safety margin. Animate the current beam from its narrow initial polygon to that larger polygon.

This preserves one continuous beam, works across desktop and portrait mobile, and provides a measurable full-coverage condition.

### 2. Fixed `vmax` scaling (rejected)

Scale the current large beam canvas by fixed `scaleX` and `scaleY` values. This is simpler, but landscape and portrait screens need very different overscan. It either leaves gaps for some lamp angles or expands excessively on others.

### 3. Viewport-corner morph or auxiliary wash (rejected)

Morph a polygon directly to the screen corners or place a full-screen wash behind the cone. Both guarantee coverage, but the viewer sees the geometry become the screen rather than seeing the spotlight itself continue to open. This is the behavior being removed.

## Geometry

Let the frozen lamp pivot be `L`, the frozen light landing point be `T`, and the normalized beam direction be `d = normalize(T - L)`. The perpendicular axis is `n = (d.y, -d.x)`. If `L` and `T` are effectively identical, use the existing downward fallback direction.

For every viewport corner `C`, calculate:

```text
longitudinal = dot(C - L, d)
perpendicular = dot(C - L, n)
```

The final beam uses these extents:

```text
backward reach = max(0, -min longitudinal) + overscan
forward length = max(0, max longitudinal) + overscan
coverage half-width = max(abs(perpendicular)) + overscan
```

The final four points form a slightly tapered beam in beam-local space:

```text
near-left  = (-coverage half-width, -backward reach)
near-right = ( coverage half-width, -backward reach)
far-right  = ( coverage half-width * 1.08, forward length)
far-left   = (-coverage half-width * 1.08, forward length)
```

Convert those points back to viewport coordinates with `L + n*x + d*y`. Use a viewport-relative overscan clamped to a small practical range so anti-aliasing and fractional pixels cannot expose an edge. Because the final polygon is wider than every corner projection at both its near and far edges, the complete viewport lies inside the same beam polygon.

The initial polygon remains the accepted narrow spotlight along the same axis. Its near edge sits only a few pixels behind the lamp mouth, its far edge extends just beyond the frozen landing point, and its far width matches the current focused beam. Interpolation changes only the four boundaries of this one beam; the axis never rotates during the transition.

## Motion And Brightness

- `0ms`: narrow current beam, opacity `0.08`.
- `176ms`: length and width have started opening, opacity `0.18`.
- `440ms`: visibly broader and longer beam, opacity `0.52`.
- `616ms`: all four beam edges have passed beyond the viewport and opacity reaches `1`.
- `616-660ms`: brief full-coverage hold before the existing route timing.

Use the existing non-linear aperture easing. Width and length must both progress monotonically; there is no flash, pulse, circular bloom, or shape switch. The final boundary must remain outside the viewport during the coverage hold.

## Component Boundaries

### `loginBeamTransition.ts`

- Keep snapshot normalization and transition timing behavior.
- Add a pure geometry function that accepts a frozen snapshot and viewport dimensions and returns initial and final four-point beam polygons.
- Keep polygon support as the only enhanced-mode capability requirement.

### `LoginBeamTransition.vue`

- Bind the pure geometry result to CSS custom properties.
- Keep one `.beam-aperture` lighting element and the retained `.lamp-snapshot`.
- Remove `.beam-wash` and any earlier hotspot or radial-mask implementation.
- Animate `.beam-aperture` between the initial and final polygons while brightness rises.
- Do not change post-coverage Dashboard presentation in this task beyond what is required to remove dependency on the discarded wash.

## Responsive And Edge Cases

- Recalculate geometry from the active viewport at transition start for desktop and mobile.
- Clamp recorded lamp and light ratios using the existing snapshot normalization.
- Use a downward axis if the lamp and landing point coincide or produce non-finite geometry.
- Include overscan on every side so rotated polygon anti-aliasing cannot expose corner pixels.
- The overlay remains fixed with `overflow: hidden`, so off-screen beam geometry never creates page overflow.

## Testing

### Unit contracts

- The geometry function keeps initial and final polygons on the same beam axis.
- The final polygon contains all four viewport corners for representative desktop, portrait mobile, edge-clamped lamp positions, and coincident lamp/light fallback cases.
- Every final polygon vertex lies beyond the viewport envelope; no vertex is deliberately mapped to a viewport corner.
- Width, length, and opacity checkpoints are monotonic.

### Integration contracts

- Exactly one `.beam-aperture` performs opening illumination.
- `.beam-wash`, `.beam-hotspot`, radial masks, and screen-corner morph keyframes are absent.
- The lamp remains above the beam.
- Login business logic and Dashboard implementation remain unchanged.

### Visual verification

- Capture `120ms`, `400ms`, and `616ms` at `1440x900` and `390x844`.
- Confirm the visible boundary remains a widening beam rather than turning into the viewport rectangle.
- Confirm all four corners are covered by the beam at `616ms` with no auxiliary lighting layer.
- Confirm the lamp-to-light axis does not drift and no horizontal overflow is introduced.

## Non-Goals

- Designing or changing the Dashboard reveal after full coverage.
- Changing login timing, API behavior, storage, routing policy, page content, layout, background, lamp geometry, follow physics, or mobile static-light behavior.
