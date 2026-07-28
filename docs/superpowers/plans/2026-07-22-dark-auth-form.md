# Dark Authentication Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved deep gray glass form treatment to login, registration, and store setup without changing lighting, layout, or behavior.

**Architecture:** Keep shared dark-surface tokens in `AuthShell.vue`, where all three pages already consume the card and basic form controls. Keep Login-only checkbox styling in `LoginView.vue` and StoreSetup-only select/dropdown styling in `StoreSetup.vue`; verify the contract through the existing source integration test.

**Tech Stack:** Vue 3 SFC scoped CSS, TypeScript, Node test runner, Vite.

## Global Constraints

- Card surface is `rgba(15, 20, 28, 0.86)` with `blur(20px) saturate(1.08)`.
- Primary text is `#f2f5f9`, labels are `#c9d1dc`, and secondary text is `#9ba8b8`.
- Inputs use `rgba(5, 9, 15, 0.72)`, border `#354152`, value `#e6ecf3`, and placeholder `#738094`.
- Preserve the existing blue action and focus treatment.
- Do not change background, lamp, physical light, motion, layout, breakpoints, validation, routing, API behavior, or copy.
- Do not stage or commit files unless the user explicitly requests it.

---

### Task 1: Shared Deep Gray Glass Surface

**Files:**
- Modify: `tests/authFollowLightIntegration.test.ts`
- Modify: `src/components/auth/AuthShell.vue`

**Interfaces:**
- Consumes: the existing `.auth-card`, `.auth-brand-row`, `.form-header`, `.form-item`, `.primary-btn`, and `.form-footer` class contract.
- Produces: shared dark card, text, and input styling consumed unchanged by `LoginView.vue`, `RegisterView.vue`, and `StoreSetup.vue`.

- [ ] **Step 1: Write the failing shared-theme test**

Add this test to `tests/authFollowLightIntegration.test.ts`:

```ts
test('the shared auth shell uses the approved deep gray glass tokens', async () => {
  const shell = await read('src/components/auth/AuthShell.vue')
  assert.match(shell, /background:\s*rgba\(15, 20, 28, 0\.86\)/)
  assert.match(shell, /color:\s*#f2f5f9/)
  assert.match(shell, /color:\s*#c9d1dc/)
  assert.match(shell, /color:\s*#9ba8b8/)
  assert.match(shell, /background:\s*rgba\(5, 9, 15, 0\.72\)/)
  assert.match(shell, /border:\s*1px solid #354152/)
  assert.match(shell, /color:\s*#e6ecf3/)
  assert.match(shell, /color:\s*#738094/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/authFollowLightIntegration.test.ts
```

Expected: FAIL in `the shared auth shell uses the approved deep gray glass tokens` because the current card and inputs still use light surfaces.

- [ ] **Step 3: Apply the shared dark tokens**

Update the relevant rules in `src/components/auth/AuthShell.vue` to use this styling:

```css
.auth-card {
  background: rgba(15, 20, 28, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.58),
    0 3px 12px rgba(0, 0, 0, 0.24),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  backdrop-filter: blur(20px) saturate(1.08);
}

.auth-brand-row strong,
.form-header h2 {
  color: #f2f5f9;
}

.form-header p,
:deep(.form-footer) {
  color: #9ba8b8;
}

:deep(.form-item label) {
  color: #c9d1dc;
}

:deep(.form-item input) {
  color: #e6ecf3;
  border: 1px solid #354152;
  background: rgba(5, 9, 15, 0.72);
}

:deep(.form-item input::placeholder) {
  color: #738094;
}
```

Also convert the brand mark to a dark blue-tinted surface, keep the existing blue SVG treatment, use a cool-gray hover border, and keep `#60a5fa` plus the existing translucent ring for focus.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/authFollowLightIntegration.test.ts
```

Expected: all integration tests PASS.

- [ ] **Step 5: Inspect the focused diff**

Run:

```bash
git diff --check -- src/components/auth/AuthShell.vue tests/authFollowLightIntegration.test.ts
git diff -- src/components/auth/AuthShell.vue tests/authFollowLightIntegration.test.ts
```

Expected: no whitespace errors; only shared authentication color/material rules and their test changed.

### Task 2: Page-Specific Dark Controls And Verification

**Files:**
- Modify: `tests/authFollowLightIntegration.test.ts`
- Modify: `src/views/LoginView.vue`
- Modify: `src/views/StoreSetup.vue`

**Interfaces:**
- Consumes: Task 1 shared card and input tokens.
- Produces: a dark Login remember-me control and dark StoreSetup select/dropdown/action controls that match the shared shell.

- [ ] **Step 1: Write failing page-specific tests**

Add this test to `tests/authFollowLightIntegration.test.ts`:

```ts
test('login and store setup special controls match the approved dark form', async () => {
  const login = await read('src/views/LoginView.vue')
  const storeSetup = await read('src/views/StoreSetup.vue')

  assert.match(login, /\.remember[\s\S]*color:\s*#9ba8b8/)
  assert.match(login, /\.checkbox-box[\s\S]*background:\s*rgba\(5, 9, 15, 0\.72\)/)

  assert.match(storeSetup, /\.select-trigger[\s\S]*background:\s*rgba\(5, 9, 15, 0\.72\)/)
  assert.match(storeSetup, /\.select-trigger[\s\S]*color:\s*#e6ecf3/)
  assert.match(storeSetup, /\.select-dropdown[\s\S]*background:\s*#101722/)
  assert.match(storeSetup, /\.setup-note[\s\S]*color:\s*#9ba8b8/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/authFollowLightIntegration.test.ts
```

Expected: FAIL because Login and StoreSetup still use light control surfaces.

- [ ] **Step 3: Convert Login-specific controls**

Update `src/views/LoginView.vue`:

```css
.remember { color: #9ba8b8; }
.remember:hover { color: #c9d1dc; }
.checkbox-box {
  border-color: #475569;
  background: rgba(5, 9, 15, 0.72);
}
```

Keep the current checked blue fill, white check mark, and blue focus ring unchanged.

- [ ] **Step 4: Convert StoreSetup-specific controls**

Update `src/views/StoreSetup.vue` so `.select-trigger` matches the shared input tokens, `.select-dropdown` uses `#101722`, regular options use light text on a dark surface, hover uses `#1b2634`, and active options retain the current blue gradient. Set `.setup-note` to `#9ba8b8`, the action divider to `rgba(255, 255, 255, 0.10)`, and the secondary button to a dark inset surface with light text.

```css
.form-item :deep(.select-trigger) {
  border-color: #354152;
  background: rgba(5, 9, 15, 0.72);
  color: #e6ecf3;
}

.form-item :deep(.select-dropdown) {
  background: #101722;
  border-color: #354152;
  color: #e6ecf3;
}

.setup-note { color: #9ba8b8; }
.form-actions { border-top-color: rgba(255, 255, 255, 0.10); }
```

- [ ] **Step 5: Run authentication tests and build**

Run:

```bash
node --test tests/authFollowLightMotion.test.ts tests/authFollowLightIntegration.test.ts
npm run build
```

Expected: 16 authentication tests PASS; production build succeeds with only the existing large-chunk warning.

- [ ] **Step 6: Perform visual verification**

Start the Vite dev server and inspect `/login`, `/register`, and `/store-setup`. Confirm:

- Warm light remains visible on the deep gray glass surface without washing out text.
- All labels, values, placeholders, footer text, and buttons remain readable.
- StoreSetup dropdown trigger, menu, hover, and active states are dark and coherent.
- Desktop pointer following and mobile static behavior are unchanged.
- No controls overlap or change layout at the existing responsive breakpoints.

- [ ] **Step 7: Inspect the final diff**

Run:

```bash
git diff --check -- src/components/auth/AuthShell.vue src/views/LoginView.vue src/views/StoreSetup.vue tests/authFollowLightIntegration.test.ts
git status --short
```

Expected: no whitespace errors; unrelated dirty-worktree files remain untouched.
