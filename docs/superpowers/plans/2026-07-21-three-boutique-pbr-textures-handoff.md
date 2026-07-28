# Three Boutique PBR Texture Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成并接入六张本地无缝 PBR PNG 纹理，使精品店场景从回退材质切换到最终纹理材质，同时保持两台设备、射灯层级和灯槽亮度不变。

**Architecture:** 纹理文件直接落入 `src/assets/textures/boutique/`，现有 `threeBoutiqueMaterials.ts` 会通过 Vite URL、`RepeatWrapping`、颜色空间和异步协调器自动加载。木材与墙面采用颜色图和同源高度图；服装仅叠加高度细节以保留设备颜色；金属仅使用粗糙度图。

**Tech Stack:** PNG, 1024x1024, Three.js r185, Vite 8, Node.js test runner, Playwright 1.61, image generation/editing tool.

## Global Constraints

- 六张纹理必须是独立 PNG，不得使用拼图、图集、远程 URL 或运行时 CDN。
- 输出统一为 `1024x1024`；不得使用 4K。
- 所有纹理必须四边无缝，可在水平和垂直方向重复。
- 颜色图是纯 albedo：不得烘焙高光、阴影、AO、方向光、透视或暗角。
- 数据图必须为中性灰度：R/G/B 通道一致；不得带颜色、文字、边框、水印或 alpha 透明区域。
- 高度图语义固定为白色较高、黑色较低，以中灰为基准；避免纯黑和纯白大面积裁切。
- 粗糙度图语义固定为白色较粗糙、黑色较光滑。
- 木材颜色图和高度图必须使用相同纹理几何；墙面颜色图和高度图同样必须逐像素对齐。
- 不修改 `scene.environmentIntensity = 0.25`。
- 不修改射灯公式 `0.7 + lamp.brightness / 100 * 10.8`。
- 不修改 `coveGlow.emissiveIntensity = 0.22`、`coveGlow.toneMapped = true`，不得给灯槽增加任何 Light。
- 不降低 QA 门槛：局部射灯对比 `>= 1.30`，衣服内核/边缘衰减 `>= 1.06`。
- 不修改设备识别、灯位数量、分区、拖拽、排序、选择、镜头或 localStorage 语义。
- 当前工作区有其他未提交修改；只触碰本计划列出的六张资产，除非实图证明必须微调材质参数。
- 未经用户明确要求，不执行 git commit。

## Current Baseline

- `node --test` 的 Three 相关套件当前为 `72/73`，唯一失败是 `smokedOakColor is missing`。
- `npm run build` 当前通过，但产生六条纹理不存在警告。
- 双 PC 视口的设备数量、`2 -> 3 -> 2`、无幽灵灯、射灯对比和光斑衰减已经通过。
- 内置 imagegen 最近返回 `503 model_not_found`。若继续失败，不得静默切换模型或 CLI；需要用户明确授权，并由用户在本机设置 `OPENAI_API_KEY`。

## Files

- Create: `src/assets/textures/boutique/smoked-oak-color.png`
- Create: `src/assets/textures/boutique/smoked-oak-height.png`
- Create: `src/assets/textures/boutique/mineral-plaster-color.png`
- Create: `src/assets/textures/boutique/mineral-plaster-height.png`
- Create: `src/assets/textures/boutique/woven-fabric-height.png`
- Create: `src/assets/textures/boutique/brushed-metal-roughness.png`
- Read only unless visual QA proves otherwise: `src/components/device/threeBoutiqueMaterials.ts`
- Test: `tests/threeBoutiqueMaterials.test.ts`
- Live QA: `scripts/qa/threeBoutiqueSceneQa.mjs`

---

### Task 1: Confirm the Asset Contract

**Files:**
- Read: `src/components/device/threeBoutiqueMaterials.ts`
- Test: `tests/threeBoutiqueMaterials.test.ts`

**Interfaces:**
- Consumes: `BOUTIQUE_TEXTURE_SPECS`
- Produces: a confirmed list of six exact filenames and current failing baseline

- [ ] **Step 1: Confirm the target directory is absent or empty**

```powershell
if (Test-Path src/assets/textures/boutique) {
  Get-ChildItem -Force src/assets/textures/boutique
} else {
  Write-Output 'MISSING_DIRECTORY'
}
```

Expected before generation: directory missing or none of the six required PNGs present.

- [ ] **Step 2: Run the focused baseline test**

```powershell
node --test tests/threeBoutiqueMaterials.test.ts
```

Expected before generation: exactly one failure, `smokedOakColor is missing`; the other material tests pass.

- [ ] **Step 3: Record protected runtime values**

```powershell
rg -n "environmentIntensity|const intensity =|emissiveIntensity: 0.22|MIN_SPOTLIGHT" src/components/device/ThreeLightingLayout.vue src/components/device/threeBoutiqueMaterials.ts scripts/qa/threeBoutiqueQaMetrics.mjs
```

Expected: environment `0.25`, spotlight coefficient `10.8`, cove emissive `0.22`, contrast `1.3`, falloff `1.06`.

---

### Task 2: Generate the Smoked Oak Pair

**Files:**
- Create: `src/assets/textures/boutique/smoked-oak-color.png`
- Create: `src/assets/textures/boutique/smoked-oak-height.png`

**Interfaces:**
- Consumes: floor repeat `[4, 6]`, plinth repeat `[2, 1]`, bump scales `0.035` and `0.018`
- Produces: aligned sRGB albedo and linear grayscale height maps

- [ ] **Step 1: Generate the oak albedo with this exact prompt**

```text
Use case: stylized-concept
Asset type: seamless 1024x1024 PBR base-color texture for a real-time Three.js luxury boutique
Primary request: photorealistic seamless smoked-oak wood albedo
Scene/backdrop: the entire square canvas is one uninterrupted flat material scan
Subject: refined smoked oak, fine mostly straight grain, subtle natural pores, restrained irregularity, charcoal brown with a quiet warm amber undertone
Style/medium: realistic physically based material capture, detailed but not exaggerated
Composition/framing: exact orthographic top-down view, edge-to-edge surface, genuinely tileable on all four edges, no focal point, no large isolated knots
Lighting: perfectly even neutral diffuse illumination; base color only
Constraints: no baked directional light, no cast shadows, no ambient occlusion, no specular highlights, no gloss, no bevels, no perspective, no borders, no objects, no text, no logo, no watermark, no vignette; seamless repetition must not reveal a grid
```

Save the accepted output as `src/assets/textures/boutique/smoked-oak-color.png`.

- [ ] **Step 2: Generate the aligned oak height map as an edit of the accepted color image**

```text
Input Image 1 role: exact geometry reference and edit target
Asset type: seamless 1024x1024 linear grayscale PBR height map
Primary request: convert the smoked-oak surface in Image 1 into a height map while preserving the exact grain placement and all four tile boundaries
Height semantics: lighter pixels are raised grain and pores; darker pixels are recessed; neutral mid-gray is the base plane
Constraints: preserve pixel geometry and seamless edges; grayscale only; restrained micro-relief; no albedo color, lighting, shadow, AO, normal-map colors, text, border, watermark, pure-black cavities, or pure-white clipping
```

Save as `src/assets/textures/boutique/smoked-oak-height.png`. Reject any result whose grain no longer aligns with the color map.

- [ ] **Step 3: Inspect a 2x2 repeat of both maps**

Acceptance: no cross-shaped seam, repeated knot, sudden grain direction change, baked highlight, or edge band. The height map must remain subtle because the floor bump scale is already `0.035`.

---

### Task 3: Generate the Mineral Plaster Pair

**Files:**
- Create: `src/assets/textures/boutique/mineral-plaster-color.png`
- Create: `src/assets/textures/boutique/mineral-plaster-height.png`

**Interfaces:**
- Consumes: wall repeats `[3, 2]` and `[2, 2]`, bump scales `0.018` and `0.012`
- Produces: aligned sRGB plaster albedo and linear grayscale height maps

- [ ] **Step 1: Generate the plaster albedo with this exact prompt**

```text
Use case: stylized-concept
Asset type: seamless 1024x1024 PBR base-color texture for a real-time Three.js luxury boutique wall
Primary request: refined warm mineral plaster albedo with fine lime-plaster variation
Scene/backdrop: the entire canvas is a flat wall-material scan
Subject: warm neutral greige mineral plaster, fine mineral speckle, soft trowel variation, quiet handcrafted depth, no large stains or cracks
Style/medium: photorealistic architectural material capture
Composition/framing: orthographic front view, edge-to-edge, tileable on all four sides, uniform visual density with no focal mark
Lighting: perfectly even neutral diffuse illumination; base color only
Constraints: no baked light, shadow, ambient occlusion, gloss, perspective, corner, molding, crack, water damage, dirt patch, text, logo, border, watermark, or vignette
```

Save as `src/assets/textures/boutique/mineral-plaster-color.png`.

- [ ] **Step 2: Generate the aligned plaster height map as an edit of the accepted color image**

```text
Input Image 1 role: exact geometry reference and edit target
Asset type: seamless 1024x1024 linear grayscale PBR height map
Primary request: convert the mineral-plaster surface in Image 1 into subtle physical height while preserving exact trowel and mineral placement
Height semantics: lighter pixels are slightly raised mineral/trowel texture; darker pixels are slightly recessed; mid-gray is the base plane
Constraints: exact alignment with Image 1, tileable edges, grayscale only, low contrast, fine micro-relief, no cracks, no albedo, no baked lighting, no AO, no normal-map colors, no text, border, watermark, black clipping, or white clipping
```

Save as `src/assets/textures/boutique/mineral-plaster-height.png`.

- [ ] **Step 3: Inspect a 3x2 repeat**

Acceptance: no visible checkerboard, repeated trowel arc, bright seam, dark seam, or large-scale stain. Wall texture must remain quieter than the two garments and their spotlights.

---

### Task 4: Generate Fabric Height and Metal Roughness

**Files:**
- Create: `src/assets/textures/boutique/woven-fabric-height.png`
- Create: `src/assets/textures/boutique/brushed-metal-roughness.png`

**Interfaces:**
- Consumes: fabric repeat `[12, 12]`, bump scale `0.012`; metal repeat `[6, 1]`
- Produces: two linear grayscale data maps

- [ ] **Step 1: Generate the woven-fabric height map**

```text
Use case: stylized-concept
Asset type: seamless 1024x1024 linear grayscale PBR height map for garment fabric
Primary request: fine premium plain-weave textile microstructure, suitable for repeated close-up garment bump detail
Composition/framing: exact orthographic macro material scan, uniform thread density, seamless on all four edges, no folds or garment silhouette
Height semantics: lighter thread crowns are raised; darker thread crossings are recessed; mid-gray is the base
Constraints: grayscale only, very fine weave, low-to-moderate contrast, no color, no print, no logo, no seam stitching, no wrinkles, no shadow, no AO, no perspective, no border, no watermark, no pure-black or pure-white clipping
```

Save as `src/assets/textures/boutique/woven-fabric-height.png`. At a `[12, 12]` repeat the weave must read as micro-detail, not a grid overlay.

- [ ] **Step 2: Generate the brushed-metal roughness map**

```text
Use case: stylized-concept
Asset type: seamless 1024x1024 linear grayscale PBR roughness map for champagne and dark metal fixtures
Primary request: restrained fine brushed-metal roughness variation with subtle directional micro-scratches and no visible damage
Composition/framing: flat orthographic material data map, uniform density, seamless on all four sides, no focal scratch
Roughness semantics: lighter pixels are rougher; darker pixels are smoother; overall value should stay mostly light gray so the existing metal does not become mirror-like
Constraints: grayscale only, weak directionality, no albedo color, no metallic color, no lighting, no reflection, no shadow, no dent, no fingerprint, no rust, no border, no text, no watermark, no pure black
```

Save as `src/assets/textures/boutique/brushed-metal-roughness.png`. Reject maps dominated by dark gray because Three.js multiplies the map by the existing material roughness.

- [ ] **Step 3: Inspect repeated previews**

Acceptance: fabric has no moire at 12x repeat; metal has no barcode bands or obvious repeating scratch. Both files are neutral grayscale.

---

### Task 5: Validate Files and Build Integration

**Files:**
- Test: `tests/threeBoutiqueMaterials.test.ts`
- Read: `src/components/device/threeBoutiqueMaterials.ts`

**Interfaces:**
- Consumes: all six final PNGs
- Produces: a passing asset contract and warning-free Vite resolution

- [ ] **Step 1: Check exact filenames and file sizes**

```powershell
Get-ChildItem src/assets/textures/boutique -File | Select-Object Name,Length
```

Expected: exactly the six required names; each file is a valid PNG and larger than `16,000` bytes.

- [ ] **Step 2: Run the material test**

```powershell
node --test tests/threeBoutiqueMaterials.test.ts
```

Expected: `11/11` pass; no missing, non-PNG, color-space, ownership, or disposal failure.

- [ ] **Step 3: Run the complete Three suite**

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeBoutiqueTextureLoadCoordinator.test.ts tests/threeSpotShadowBudget.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts tests/threeBoutiqueQaHarness.test.ts tests/threeBoutiqueQaMetrics.test.ts
```

Expected: all `73` tests pass.

- [ ] **Step 4: Run the production build**

```powershell
npm run build
```

Expected: build passes and none of the six `new URL(...texture...) doesn't exist at build time` warnings remain. The existing large-chunk warning is outside this task.

---

### Task 6: Run Live Visual QA and Tune Assets Only

**Files:**
- Read: `output/playwright/three-boutique-qa.json`
- Inspect: `output/playwright/three-boutique-1920x1080.png`
- Inspect: `output/playwright/three-boutique-2560x1440.png`

**Interfaces:**
- Consumes: built application with all six textures
- Produces: browser evidence that textures load without weakening spotlight hierarchy

- [ ] **Step 1: Start the QA server**

```powershell
npm run dev -- --host 127.0.0.1 --port 5178
```

Keep it running. If `5178` is occupied, start another port and set `THREE_QA_BASE_URL` to that exact dashboard URL before running QA.

- [ ] **Step 2: Run live QA**

```powershell
node scripts/qa/threeBoutiqueSceneQa.mjs
```

Expected texture checks:

- `textureProbeCoverage: true`
- `textureSpecsMatch: true`
- `textureAssetsPresent: true`
- `textureWarnings: true` (the boolean check means no texture warnings were emitted)
- every probe returns one `2xx` response with `content-type: image/png`

Expected scene checks:

- exact real IDs `101` and `102`
- two initial real slots, zero initial manual slots
- interaction lifecycle `2 -> 3 -> 2`
- zero manufactured placeholders and zero final manual ghosts
- `spotlightContrast: true` at `>= 1.30`
- `spotlightFalloff: true` at `>= 1.06`
- no console, page, request, HTTP, or texture errors

- [ ] **Step 3: Inspect both screenshots at original resolution**

Acceptance checklist:

- smoked oak reads as fine luxury wood; no giant grain, obvious 4x6 tiling, or baked light
- plaster remains quiet and does not form a visible grid behind the garments
- fabric weave is visible only as close micro-detail and does not change red/green device colors
- metal keeps restrained highlights and does not become chrome or black plastic
- the cove remains a controlled line and never becomes the dominant product light
- both garments retain a localized bright center and visible edge falloff
- no texture swimming, UV seam, moire, clipping, mesh overlap, or black material

- [ ] **Step 4: Correct assets before changing code**

If a surface is too strong, too glossy, too dark, or visibly tiled, regenerate or reduce contrast in that PNG first. Do not lower QA thresholds or change the established scene lights to compensate for a bad map.

Only if the texture itself is correct at multiple repeat previews but the scene response remains excessive may the implementer adjust these existing values in `threeBoutiqueMaterials.ts`, one at a time with a failing contract test first:

- floor `bumpScale = 0.035`
- wall `bumpScale = 0.018`
- wall inset `bumpScale = 0.012`
- plinth `bumpScale = 0.018`
- fabric `bumpScale = 0.012`

Do not change lighting, exposure, device brightness, color-space configuration, texture repeats, or the cove to solve texture-authoring defects.

- [ ] **Step 5: Handle hardware FPS honestly**

If the report identifies SwiftShader/WARP/llvmpipe/softpipe/lavapipe, keep `hardwarePerformanceEligible: false` and report FPS as not verifiable in that environment. Do not weaken renderer detection or the `45 FPS` hardware threshold.

---

### Task 7: Final Review and Handoff

**Files:**
- Review: the six PNG files and generated QA artifacts
- Review: `src/components/device/threeBoutiqueMaterials.ts` only if it changed

- [ ] **Step 1: Run a read-only final review**

Review for incorrect map semantics, mismatched color/height pairs, visible seams, oversized assets, changed protected lighting values, missing disposal, and weakened QA gates.

- [ ] **Step 2: Report exact outcomes**

The handoff must include:

- six saved asset paths and dimensions
- generation/edit prompts used
- material test result
- complete Three test result
- build result and remaining warnings
- both viewport spotlight contrast/falloff values
- renderer identity and whether hardware FPS was eligible
- links to the JSON report and two screenshots

- [ ] **Step 3: Leave unrelated work untouched**

Do not stage or revert unrelated dirty-worktree files. Commit only after explicit user authorization, and then stage exact asset/test paths rather than using `git add .`.

## Completion Criteria

This continuation is complete only when all six PNG files exist in the exact directory, `73/73` tests pass, the six Vite missing-texture warnings disappear, texture probes and warnings pass, both spotlight checks remain above threshold at both PC viewports, and screenshot inspection finds no visible tiling or material regression.
