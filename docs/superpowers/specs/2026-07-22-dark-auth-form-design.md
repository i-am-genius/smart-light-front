# Dark Authentication Form Design

## Status

Approved visual direction: option A, deep gray glass.

## Goal

Convert the shared authentication form surface to a dark material that works with the existing warm physical spotlight while keeping all content readable. Login, registration, and store setup must use the same visual foundation.

## Scope

- Update the shared `AuthShell` card, brand row, headings, supporting text, labels, text inputs, primary button integration, and footer text/link colors.
- Update Login-specific remember-me text and checkbox colors.
- Update StoreSetup-specific select triggers, dropdowns, options, setup note, action divider, and secondary button.
- Preserve the current layout, spacing, dimensions, breakpoints, background image, lamp model, physical lighting, pointer following, validation, routing, and API behavior.

## Visual Tokens

- Card surface: `rgba(15, 20, 28, 0.86)` with `backdrop-filter: blur(20px) saturate(1.08)`.
- Card border: `rgba(255, 255, 255, 0.14)` with a subtle light inner edge.
- Card shadow: deep neutral shadow, retaining the existing elevation without a blue cast.
- Primary text: `#f2f5f9`.
- Labels: `#c9d1dc`.
- Secondary text: `#9ba8b8`.
- Input surface: `rgba(5, 9, 15, 0.72)`.
- Input border: `#354152`; hover uses a lighter cool-gray border.
- Input value: `#e6ecf3`; placeholder: `#738094`.
- Focus: retain the existing blue focus language with `#60a5fa` and a translucent focus ring.
- Links and primary actions: retain the existing blue family so the dark conversion does not alter action hierarchy.
- Warm light: retain the existing Three.js spotlight settings and overlay calibration unchanged.

## Component Details

### Shared Card

The card remains translucent so the warm spotlight creates a restrained amber reflection instead of appearing as a flat overlay. The current radius, padding, and entrance animation remain unchanged.

### Inputs

Inputs use a darker inset surface than the card. Hover only raises border contrast; focus raises border contrast and slightly lifts the input background. Disabled and loading behavior remain unchanged.

### Brand And Copy

The brand mark moves to a dark blue-tinted surface. Brand, title, label, subtitle, and footer colors are inverted to the approved hierarchy without changing typography or copy.

### Login Controls

The remember-me label uses secondary text. Its unchecked box uses the dark input surface and cool-gray border; checked and focus states retain the existing blue treatment.

### Store Setup Controls

Select triggers match text inputs. Dropdowns use an opaque dark surface for readability, with a darker hover row and the existing blue active option. The setup note, action divider, and secondary button are converted to the same dark hierarchy.

## Responsive Behavior

No layout or breakpoint changes. Mobile uses the same dark tokens, with the existing static lighting behavior and existing card sizing.

## Verification

- Add a focused integration test that asserts the approved dark card and input tokens are present.
- Assert Login and StoreSetup page-specific controls use dark surfaces and light text.
- Run the existing authentication lighting and motion tests.
- Run `npm run build`.
- Visually inspect login, registration, and store setup at desktop size; verify mobile static behavior where the available browser supports viewport emulation.

## Non-Goals

- No changes to the background, lamp, light physics, motion, layout, validation, API calls, navigation, or form copy.
- No new theme toggle or reusable application-wide dark-theme system.
