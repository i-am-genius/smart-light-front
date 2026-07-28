# Neutral Fabric Detail Layer Design

## Goal

Make the existing `woven-fabric-height.png` visibly readable on garments in the dashboard's close adjustment view without modifying the PNG, replacing runtime garment colours, or changing lights and geometry.

## Evidence

- The PNG loads successfully and is assigned to fabric materials.
- Increasing `bumpScale` to `0.2` did not make the front-facing garments visibly textured under the current head-on spotlights.
- Temporarily assigning the same texture to `map` made the weave immediately visible, proving the texture and front-face UVs are valid.

## Design

The fabric material will reuse one derived texture as both `map` and `bumpMap`. A material-local `onBeforeCompile` hook will replace Three.js's standard map multiplication with a neutral detail calculation:

```glsl
float fabricDetail = clamp(1.0 + (sampledDiffuseColor.r - 0.56) * 1.8, 0.65, 1.35);
diffuseColor.rgb *= fabricDetail;
```

The midpoint `0.56` matches the existing texture's approximate mean grayscale, so the detail oscillates around `1.0` instead of darkening the garment like ordinary `map × color` multiplication. Alpha remains multiplied normally.

The material samples three quarters of the existing PNG (`repeat = 0.75`, default offset), making the weave 1.5 times finer than the confirmed-visible `0.5` version while staying below the mipmap-heavy `repeat = 1` endpoint. The PNG file itself is unchanged. The existing `bumpScale = 0.012` remains as secondary PBR relief.

## Scope

- Modify only the shared fabric material behavior and its tests.
- Preserve garment base/trim/seam colours and runtime colour updates.
- Preserve texture ownership and disposal behavior.
- Do not change lights, camera, renderer resolution, clothing geometry, or other boutique materials.
- Do not commit.

## Verification

- TDD regression asserts `map === bumpMap`, centered detail UV transform, unchanged colours, shader replacement, stable cache key, and fallback cleanup.
- Run the complete Three test suite and production build.
- Capture the close adjustment view and visually confirm clear but restrained weave detail on orange and green garments.
