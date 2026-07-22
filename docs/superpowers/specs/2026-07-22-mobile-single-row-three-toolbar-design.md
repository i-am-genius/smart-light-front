# Mobile Single-Row Three Toolbar Design

## Goal

Reduce the mobile 3D layout toolbar from two tall rows to one compact row without changing the desktop layout or removing any command.

## Layout

- Apply the compact layout only when the `ThreeLightingLayout` container is at most 620px wide.
- Render the zone switcher, slot actions, and view switcher in one grid row.
- Keep the toolbar inside the scene's left and right inset with no horizontal scrolling or wrapping.
- Target a control height of 32px and a total toolbar height of about 42px including padding.

## Mobile Labels

- Keep the zone name and `current / total` indicator visible.
- Shorten the slot count to its numeric value where space is constrained.
- Show compact command labels: `+`, `均排`, `展`, and `调`.
- Preserve or add full command names through `aria-label` and `title` attributes.

## Desktop Behavior

Desktop and tablet layouts above the 620px container breakpoint remain unchanged.

## Validation

- Add a source contract test requiring a single-row mobile grid and compact control dimensions.
- Run the existing ThreeLightingLayout workbench tests and production build.
- Capture the layout at 390px viewport width and verify the toolbar has one row, no horizontal overflow, and no overlap with the scene.
