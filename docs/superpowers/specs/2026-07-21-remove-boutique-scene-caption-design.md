# Remove Boutique Scene Caption Design

## Goal

Remove the decorative two-line caption “精品服装灯光 / 轨道编排工作台” from the Three lighting scene.

## Scope

- Delete the `.scene-overlay` template node.
- Delete all desktop and mobile `.scene-overlay` styles.
- Preserve the zone toolbar, lamp count, view-mode buttons, selection controls, canvas, and Three scene.
- Update structural tests so the removed text and class cannot return accidentally.
- Do not commit.
