# Auth Light Follow Prototype Design

## Goal

Create a standalone login-page HTML prototype that preserves the supplied
layout and background while replacing the drag-and-swing lamp interaction with
a restrained mouse-following light. The prototype validates the visual and
interaction direction before any Vue authentication page is changed.

## Scope

The prototype contains the login view only. It keeps the supplied page surface,
content hierarchy, login card, background treatment, and responsive layout.
It changes only the lamp interaction and the lighting/readability balance.

Out of scope:

- Login, registration, or store-setup API integration
- Changes to the current Vue application
- Adjustable beam angle, brightness controls, color controls, or drag gestures
- Pendulum physics, release momentum, or spring overshoot
- Mobile pointer or touch-follow behavior

## Recommended Architecture

Use a hybrid rendering model:

- The login interface remains normal HTML so inputs, keyboard focus, password
  managers, links, and mobile text entry continue to work normally.
- A transparent Three.js canvas renders only the hanging lamp, cable, bulb, and
  glow above the HTML surface.
- CSS lighting layers render the warm spotlight, broad ambient bloom, and mild
  peripheral dimming. Their positions are updated through CSS custom
  properties derived from the lamp target.
- The existing CSS lamp remains available as a static fallback when Three.js
  cannot load or WebGL cannot initialize.

This avoids the input and accessibility risks of rendering the complete form
into an HTML texture while retaining the dimensional lamp model.

## Desktop Interaction

The pointer controls a target, not a dragged object.

1. Pointer movement maps the horizontal pointer coordinate into a bounded lamp
   track near the top of the viewport.
2. The lamp position converges on that target through a non-linear follower.
   Large errors produce stronger acceleration; small errors produce smooth
   braking.
3. Velocity is damped and each step is clamped to the remaining distance. The
   lamp cannot overshoot, rebound, or enter a pendulum state.
4. The lamp head rotates toward the pointer's projected landing point with a
   slightly slower interpolation than the lamp body.
5. The spotlight landing point follows the same projected target with a small,
   deliberate delay to convey weight without creating swing.
6. When the pointer leaves the window, the target returns gradually to the
   default position that illuminates the login form.

The fixed beam width is not exposed as a control. Pointer interaction never
captures clicks intended for inputs, buttons, or links.

## Lighting And Readability

Lighting enhances the interface rather than revealing otherwise hidden text.

- The page surface retains readable base colors at all times.
- Peripheral dimming is limited to approximately 12-18 percent opacity.
- A broad, soft amber spotlight adds local warmth and contrast.
- A low-opacity fixed fill remains over the login-card region, even when the
  moving spotlight points elsewhere.
- Spotlight edges use broad feathering, and bloom is weaker than the supplied
  prototype to avoid a pasted radial-gradient appearance.
- Text, labels, placeholders, borders, and actions must remain readable outside
  the moving hotspot.
- The light color remains the supplied warm amber. There are no user-facing
  lighting controls.

## Mobile Behavior

At the existing mobile breakpoint, the supplied layout and background remain
unchanged.

- Pointer and touch following are disabled.
- The animation loop does not run continuously.
- The lamp is placed at a fixed top-center position.
- The lamp head and spotlight are aimed at the login card by default.
- The form receives the same permanent low-level fill used on desktop.
- Reduced-motion mode uses the same static presentation on every viewport.

## Visual Details

The lamp keeps the supplied industrial form: dark metal shade, warm copper
connector, visible bulb, soft underside emission, narrow cable, and restrained
glow. The page surface, grid texture, border, header, content, login card, and
background are preserved from the supplied HTML.

The signature moment is the weighted, delayed horizontal lamp response paired
with a softer delayed light landing. No other decorative motion is added.

## Failure Handling

- If the Three.js module cannot load, display the existing CSS fallback lamp.
- If WebGL initialization fails, keep the CSS lighting layers at their default
  form-focused position.
- The login form remains interactive in every fallback state.
- Runtime failures must not make the page darker than the readable base state.

## Prototype Verification

The standalone prototype will be checked at desktop and mobile viewport sizes.
Verification covers:

- The original layout and background remain visually unchanged.
- Desktop pointer movement produces delayed, non-linear, non-overshooting lamp
  motion.
- The lamp and light return toward the form after pointer exit.
- Unlit content remains readable across the surface.
- Inputs, password visibility, remember-me, links, and submit validation work.
- Mobile uses a static lamp and fixed form lighting with no continuous motion.
- Reduced-motion mode is static.
- The fallback presentation remains readable if Three.js is unavailable.

## Deliverable

Produce one standalone login prototype HTML file outside the application source
files. It can be opened directly in a browser and will serve as the visual
approval artifact before implementation in `AuthShell.vue` and the three target
views.
