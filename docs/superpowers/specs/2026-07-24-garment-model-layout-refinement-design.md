# Garment Model and Layout Refinement Design

## Goal

Improve the procedural clothing shown in the store-layout Three.js scene. Keep the existing upper-garment silhouette, rebuild the newer pants, skirt, and dress models with comparable detail, connect two-piece outfits visually, and prevent every garment from intersecting the display plinth.

## Evidence and Root Cause

- `src/components/device/threeGarmentModels.ts` builds pants as two independent trapezoidal legs, the skirt as one flat trapezoid, and the dress as one simple outline. These models have much less construction detail than the existing upper garment.
- A two-piece display currently applies fixed offsets of `0.47` to the upper garment and `-0.45` to the lower garment. Their visible edges remain about `0.41` scene units apart.
- With the scene display base at `0.72`, the measured two-piece lower bound is about `-0.166`, while the display-plinth top surface is at about `0.448`.
- The measured dress lower bound is about `0.144`, so it also intersects the plinth.
- The fixed offsets are the underlying layout defect: they do not account for the bounds of different garment shapes.

## Approach

Continue using procedural Three.js geometry and the existing fabric-material factory. Do not add external GLTF assets. This preserves dynamic garment colours, the fabric-detail layer, disposal ownership, and the current lightweight scene-loading behavior.

Replace fixed outfit offsets with a bounds-based layout function. The function will measure each garment group after construction and position or uniformly scale it within the vertical display area defined by the rail and the plinth clearance line.

## Garment Geometry

### Existing Upper Garment

Preserve its outline and construction details. It remains the visual reference for material thickness, beveling, trim, seam scale, and procedural complexity.

### Pants

- Add a continuous waist and hip section so the legs read as one garment.
- Shape the inner legs around a recognizable crotch instead of leaving a rectangular center gap.
- Use slightly tapered outer and inner leg curves rather than four straight trapezoid edges.
- Add a waistband, center fly, front crease or seam lines, side seams, and defined hems.
- Keep the geometry shallow and front-facing so it remains consistent with the wall-display style.

### Skirt

- Replace the rigid trapezoid with a softly curved A-line silhouette.
- Add a shaped waistband and a distinct hem.
- Add restrained vertical fold or panel lines that follow the flare.
- Keep folds shallow enough to avoid noisy shadows at the dashboard camera distance.

### Dress

- Build a recognizable bodice with shoulders, neckline, and armholes.
- Join the bodice and skirt continuously at a defined waist seam.
- Use a curved, gently flared skirt with a finished hem and subtle vertical folds.
- Preserve one full-body garment group so recognition, colour updates, signatures, and disposal behavior remain unchanged.

## Layout Rules

### Safe Display Area

- Share named layout metrics between the scene and garment-layout code: display base `0.72`, rail height `1.98`, plinth top `0.448`, and garment clearance `0.06` scene units.
- The allowed garment band in display-local coordinates is therefore `-0.212` through `1.26`.
- Treat `-0.212` as the lowest allowed garment point and the rail coordinate `1.26` as the upper hanging anchor.
- Keep the `0.06` clearance visually detectable so antialiasing, bevels, and shadows do not appear to touch the plinth.

### Single Garments

- Preserve the current upper-only presentation unless the bounds violate the safe area.
- Align lower-only garments by their hanger to the rail and verify their bottom remains above the plinth.
- Align a dress by its hanger to the rail, then uniformly scale it only if required to keep its hem above the clearance line.

### Two-Piece Outfits

- Hide the lower garment's standalone hanger; the outfit should read as one coordinated set.
- Place the lower waistband behind the upper hem with a target vertical overlap of `0.025` scene units after scaling. Acceptable overlap is `0.015` through `0.05`; a positive gap is not allowed.
- Uniformly scale both pieces by the same factor when the natural combined height does not fit between the rail and plinth clearance.
- Anchor the combined outfit to the rail and keep its lowest point at or above the clearance line.
- Do not merge materials or meshes: upper and lower colours must continue updating independently.

## Data and Lifecycle Compatibility

- Keep the public garment factory functions and `createGarmentDisplay` API unchanged.
- Preserve `garmentPosition`, `garmentCategory`, garment roles, ownership flags, and display signatures.
- Mark hanger meshes explicitly so layout code can align or hide them without depending on child order.
- Continue using the existing material factory and release callbacks.
- A same-signature colour update must not rebuild geometry.

## Testing

Add regression tests before implementation that assert:

- Pants contain a connected waist/hip construction and recognizable finishing details.
- Skirt and dress expose the intended trim/seam detail roles.
- Two-piece pants and skirt outfits have no positive waist gap and retain `0.015` through `0.05` scene units of overlap.
- The lower bound of every two-piece outfit remains at or above display-local `-0.212`.
- Dress and lower-only displays remain above that line.
- A two-piece display hides the lower hanger while retaining the upper hanger.
- Upper and lower colours still update independently without geometry replacement.
- Existing resource-disposal and atomic display-swap tests continue to pass.

Run the targeted Node test file, the broader relevant test suite, and `npm run build`. Then capture the store-layout scene and visually verify pants, skirt, dress, outfit connection, rail alignment, and plinth clearance at the normal dashboard camera view.

## Non-Goals

- Do not change the recognition payload or garment categories.
- Do not change the store panel, rail, plinth, lights, camera, or fabric texture system.
- Do not introduce downloaded models or new runtime dependencies.
- Do not redesign the already accepted upper-garment silhouette.
