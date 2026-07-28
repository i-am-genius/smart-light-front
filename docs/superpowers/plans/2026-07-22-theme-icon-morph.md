# Theme Icon Morph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disconnected font-symbol theme toggle with one continuously morphing sun-to-moon SVG.

**Architecture:** Keep the existing `isNightMode` state and event flow unchanged. Render one inline SVG whose rays, shared orb, mask cutout, and star are driven entirely by the existing `.is-night` button class, so interrupted transitions reverse naturally without JavaScript animation state.

**Tech Stack:** Vue 3 SFC, scoped CSS, inline SVG masks, Node test runner, Vite.

## Global Constraints

- Use one `24 x 24` inline SVG with one shared center orb.
- Complete the transition in approximately `420ms`.
- Use warm gold in day mode and cool blue in night mode.
- Preserve the existing button size, copy, `aria-label`, `aria-pressed`, state update, and persistence behavior.
- Disable transform and opacity transitions under `prefers-reduced-motion: reduce`.
- Do not add dependencies or modify global theme behavior.
- Do not stage or commit files, as explicitly requested by the user.

---

### Task 1: Continuously Morphing Theme Icon

**Files:**
- Create: `tests/storeSettingsThemeIcon.test.ts`
- Modify: `src/components/settings/StoreSettingsPanel.vue`

**Interfaces:**
- Consumes: existing `isNightMode` computed state and `.store-action-btn--theme.is-night` class.
- Produces: `.theme-mode-svg`, `.theme-sun-rays`, `.theme-orb`, `.theme-mask-cutout`, and `.theme-star` visual elements without changing emitted events.

- [ ] **Step 1: Write the failing source-contract test**

Create `tests/storeSettingsThemeIcon.test.ts` with assertions that parse the SFC and require one SVG, the crescent mask, eight ray lines, shared orb, star, `420ms` motion, night selectors, and reduced-motion fallback:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { compileStyle, parse } from '@vue/compiler-sfc'

const filename = 'StoreSettingsPanel.vue'
const source = readFileSync(new URL('../src/components/settings/StoreSettingsPanel.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source, { filename })
const template = descriptor.template?.content ?? ''
const style = descriptor.styles[0]?.content ?? ''
const compiledStyle = compileStyle({ filename, id: 'data-v-theme-icon-test', scoped: true, source: style })

describe('store settings theme icon', () => {
  it('uses one SVG whose shared orb becomes a crescent', () => {
    const iconMarkup = template.match(/<span class="theme-mode-icon"[\s\S]*?<\/span>/)?.[0] ?? ''
    assert.equal((iconMarkup.match(/<svg\b/g) ?? []).length, 1)
    assert.match(iconMarkup, /<mask id="theme-crescent-mask"/)
    assert.match(iconMarkup, /class="theme-mask-cutout"/)
    assert.match(iconMarkup, /class="theme-orb"/)
    assert.match(iconMarkup, /class="theme-star"/)
    assert.equal((iconMarkup.match(/class="theme-sun-ray"/g) ?? []).length, 8)
    assert.doesNotMatch(iconMarkup, /theme-mode-symbol|☀|☾/)
  })

  it('defines reversible night motion and a reduced-motion fallback', () => {
    assert.deepEqual(compiledStyle.errors, [])
    assert.match(style, /--theme-morph-duration:\s*420ms/)
    assert.match(style, /\.store-action-btn--theme\.is-night \.theme-mask-cutout/)
    assert.match(style, /\.store-action-btn--theme\.is-night \.theme-sun-rays/)
    assert.match(style, /\.store-action-btn--theme\.is-night \.theme-star/)
    assert.match(style, /@media \(prefers-reduced-motion: reduce\)/)
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/storeSettingsThemeIcon.test.ts
```

Expected: FAIL because the current icon contains two `.theme-mode-symbol` font glyphs and no SVG mask.

- [ ] **Step 3: Replace the icon with one masked SVG**

Replace the two symbol spans inside `.theme-mode-icon` with:

```vue
<svg class="theme-mode-svg" viewBox="0 0 24 24" focusable="false">
  <defs>
    <mask id="theme-crescent-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <rect width="24" height="24" fill="white" />
      <circle class="theme-mask-cutout" cx="16.2" cy="8.4" r="6.4" fill="black" />
    </mask>
  </defs>
  <g class="theme-sun-rays">
    <line class="theme-sun-ray" x1="12" y1="1.75" x2="12" y2="4.25" />
    <line class="theme-sun-ray" x1="12" y1="19.75" x2="12" y2="22.25" />
    <line class="theme-sun-ray" x1="1.75" y1="12" x2="4.25" y2="12" />
    <line class="theme-sun-ray" x1="19.75" y1="12" x2="22.25" y2="12" />
    <line class="theme-sun-ray" x1="4.75" y1="4.75" x2="6.5" y2="6.5" />
    <line class="theme-sun-ray" x1="17.5" y1="17.5" x2="19.25" y2="19.25" />
    <line class="theme-sun-ray" x1="4.75" y1="19.25" x2="6.5" y2="17.5" />
    <line class="theme-sun-ray" x1="17.5" y1="6.5" x2="19.25" y2="4.75" />
  </g>
  <circle class="theme-orb" cx="12" cy="12" r="5.75" mask="url(#theme-crescent-mask)" />
  <path class="theme-star" d="M19.25 5.2v2.4M18.05 6.4h2.4" />
</svg>
```

- [ ] **Step 4: Implement the reversible CSS morph**

Replace the `.theme-mode-symbol` rules with fixed-size SVG rules. Use `--theme-morph-duration: 420ms`, shared transform origins at the SVG center, warm `#d97706`, cool `#818cf8`, a ray collapse with rotation, a mask cutout that moves from outside the orb into place, and a star that scales from zero to one with a mild overshoot easing. Add a reduced-motion media query that sets all theme SVG transition durations to `0.01ms` and removes elastic transforms.

```css
.theme-mode-icon {
  --theme-morph-duration: 420ms;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.theme-mode-svg {
  width: 22px;
  height: 22px;
  overflow: visible;
  color: #d97706;
  transition: color var(--theme-morph-duration) ease, transform var(--theme-morph-duration) cubic-bezier(.34, 1.56, .64, 1);
}

.theme-sun-rays,
.theme-orb,
.theme-mask-cutout,
.theme-star {
  transform-box: view-box;
  transform-origin: 12px 12px;
}

.store-action-btn--theme.is-night .theme-mode-svg { color: #818cf8; transform: scale(1.03); }
.store-action-btn--theme.is-night .theme-sun-rays { opacity: 0; transform: rotate(32deg) scale(.32); }
.store-action-btn--theme.is-night .theme-mask-cutout { opacity: 1; transform: translate(0, 0) scale(1); }
.store-action-btn--theme.is-night .theme-star { opacity: 1; transform: translate(0, 0) scale(1); }

@media (prefers-reduced-motion: reduce) {
  .theme-mode-svg,
  .theme-sun-rays,
  .theme-orb,
  .theme-mask-cutout,
  .theme-star {
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/storeSettingsThemeIcon.test.ts
```

Expected: both theme icon tests PASS.

- [ ] **Step 6: Run related regression tests and production build**

Run:

```bash
node --test tests/storeSettingsThemeIcon.test.ts tests/topStatusBarStructure.test.ts
npm run build
```

Expected: tests PASS and the Vite production build succeeds.

- [ ] **Step 7: Verify the live control visually**

Start Vite, open the settings tab at desktop and mobile widths, and capture day and night screenshots. Click in both directions and rapidly reverse mid-transition. Confirm the shared orb remains visually continuous, the rays retract cleanly, the crescent is recognizable, the star stays inside the `22 x 22` icon area, and button text does not shift.

- [ ] **Step 8: Inspect the final diff**

Run:

```bash
git diff --check -- src/components/settings/StoreSettingsPanel.vue tests/storeSettingsThemeIcon.test.ts
git status --short
```

Expected: no whitespace errors; the existing dirty-worktree changes remain untouched.
