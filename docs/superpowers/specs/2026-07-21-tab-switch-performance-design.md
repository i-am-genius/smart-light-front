# Tab Switch Performance Design

## Goal

Remove the visible tab-switch stalls on desktop and mobile without reducing the existing motion, Three.js scene quality, Chart.js presentation, glass effects, or sidebar refraction.

## Confirmed cause

`SmartLightDashboard.vue` currently renders one `v-if / v-else-if` branch inside a single `Transition`. Every switch therefore unmounts the previous page and mounts the next one. Returning to `main` creates a new WebGL context, PMREM environment, meshes, materials, shadows, and texture uploads; leaving it disposes the renderer and forces context loss. The sidebar simultaneously performs CPU pixel refraction for the full 420 ms transition.

## Chosen architecture

### Lazy persistent tab pages

Track a reactive set of tabs that have been visited. Each tab owns an independent Vue `Transition` and renders its section when first visited. After that first mount, `v-show` controls visibility so the component tree remains alive.

- Initial load mounts only the requested tab.
- The first visit to another tab retains the current enter/leave animation.
- Later visits reuse Three.js and Chart.js instances.
- `ThreeLightingLayout.active` continues to stop rendering while `main` is hidden and restart it when visible.
- Reactivation waits for `v-show` to restore layout, remeasures the WebGL viewport, and ignores zero-sized hidden hosts so desktop resize and mobile rotation cannot corrupt the camera aspect.
- Existing scroll restoration and transition measurement hooks remain the source of page motion behavior.

### Cached sidebar refraction sources

Capture the static and drag refraction source canvases into `ImageData` only when the source scene is rebuilt. Each animation frame reuses the corresponding cached pixels while preserving the existing sampling, chromatic split, reflection, alpha, and output code exactly.

Canvas contexts that are read repeatedly use the `willReadFrequently` hint. Resizing or rebuilding invalidates and refreshes the cache.

## Alternatives rejected

1. **Extract every tab into dynamic components under `KeepAlive`:** architecturally clean but requires a large prop/event extraction from the dashboard and creates unnecessary regression risk.
2. **Cache Three.js resources outside the component:** preserves only the most expensive page and requires reconnecting component-local watchers, events, and DOM ownership after remount.
3. **Reduce shadows, texture resolution, blur, or animation:** violates the visual-quality constraint and treats symptoms instead of lifecycle churn.

## Testing

- Source-contract tests require lazy visited-tab tracking, separate transitions, and `v-show` persistence.
- Source-contract tests require cached `ImageData` reads outside the per-frame refraction renderer.
- Existing Node tests and the production build must pass.
- Browser QA covers `main ↔ flow`, `main ↔ settings`, and `main ↔ firmware` at 1440 × 900 and 390 × 844.
- Returning to `main` must not emit a new Three.js renderer warning after the first main mount, and canvas counts must show reuse rather than renderer destruction/recreation.

## Non-goals

- No visual redesign.
- No animation-duration change.
- No texture, material, shadow, DPR, or Chart.js quality reduction.
- No unrelated dashboard refactor.
