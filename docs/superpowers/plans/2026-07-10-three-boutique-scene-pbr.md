# Three 琥珀画廊场景 PBR 优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Three 服装店升级为 PC 优先的琥珀画廊场景，先完成空间、色彩管理与灯光层级，再用本地混合 PBR 纹理提升各模型细节，同时保证灯槽不会覆盖设备射灯效果。

**Architecture:** `ThreeLightingLayout.vue` 继续拥有设备状态、交互和 Three.js 生命周期；新增 `threeBoutiqueMaterials.ts` 管理回退材质、本地纹理加载、动态织物材质和资源释放。整体场景先使用回退 PBR 材质完成并验收，再生成和接入本地纹理；灯槽使用独立 Three.js layer，只照亮建筑表面。

**Tech Stack:** Vue 3 `<script setup>`, TypeScript 6, Three.js r185, Vite 8, Node.js test runner, Playwright 1.61, local PNG textures, OpenAI image generation.

## Global Constraints

- 视觉方向固定为「A：琥珀画廊精品店」。
- 必须按顺序实施：整体渲染与空间优先，模型纹理细节随后。
- PC 浏览器为目标平台；验证 1920x1080 与 2560x1440。
- `renderer.setPixelRatio()` 上限保持 `2`。
- 输出色彩空间为 `THREE.SRGBColorSpace`，色调映射为 `THREE.ACESFilmicToneMapping`。
- 纹理以 1K 为主；地板和主墙允许 2K；不使用 4K。
- 本地纹理随 Vite 打包，禁止运行时 CDN 或远程纹理请求。
- 灯槽只照亮建筑表面，不得直接照亮服装、轨道灯或摄像头。
- 默认亮度下，服装主光中心至少为相邻灯槽墙面的 `1.8` 倍，目标约 `3` 倍。
- 不修改 Three 场景外的 UI、文案或页面布局。
- 不修改 props、emits、localStorage key/shape、设备识别、灯位数量、分区、拖拽、排序、选择或镜头模式语义。
- 保留“两台真实设备只产生两个灯位”的回归测试。
- 不新增运行时 npm 依赖，不加入后处理通道。
- 工作区已有用户改动；禁止 reset、checkout 或覆盖无关变更。每次提交前运行 `git diff --cached --name-status`，只暂存当前任务文件。

---

## File Structure

- Create: `src/components/device/threeBoutiqueMaterials.ts` — 回退 PBR 材质、纹理清单、异步加载、动态织物和释放。
- Create: `src/assets/textures/boutique/smoked-oak-color.png`
- Create: `src/assets/textures/boutique/smoked-oak-height.png`
- Create: `src/assets/textures/boutique/mineral-plaster-color.png`
- Create: `src/assets/textures/boutique/mineral-plaster-height.png`
- Create: `src/assets/textures/boutique/woven-fabric-height.png`
- Create: `src/assets/textures/boutique/brushed-metal-roughness.png`
- Modify: `src/components/device/ThreeLightingLayout.vue` — 渲染基线、完整房间、灯光分层与模型材质。
- Create: `tests/threeBoutiqueMaterials.test.ts` — 材质 API、贴图配置、回退和资源文件。
- Modify: `tests/threeLightingLayoutScene.test.ts` — 场景结构、灯槽隔离、模型细节和生命周期。
- Create: `tests/threeBoutiqueQaHarness.test.ts` — QA 脚本与阈值契约。
- Create: `scripts/qa/threeBoutiqueSceneQa.mjs` — PC 浏览器亮度、纹理、错误和帧率检查。

## Phase 1: Overall Scene

### Task 1: Establish fallback PBR materials without texture assets

**Files:**

- Create: `tests/threeBoutiqueMaterials.test.ts`
- Create: `src/components/device/threeBoutiqueMaterials.ts`
- Test: `tests/threeBoutiqueMaterials.test.ts`

**Interfaces:**

- Consumes: `THREE.ColorRepresentation` and optional `BoutiqueTextureSet`.
- Produces: `BOUTIQUE_TEXTURE_SPECS`, `configureBoutiqueTexture()`, `loadBoutiqueTextures()`, `createBoutiqueMaterialLibrary()`, `BoutiqueMaterialLibrary`.

- [ ] **Step 1: Write the failing material contract**

Create `tests/threeBoutiqueMaterials.test.ts`:

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as THREE from 'three'
import {
  BOUTIQUE_TEXTURE_SPECS,
  configureBoutiqueTexture,
  createBoutiqueMaterialLibrary,
  loadBoutiqueTextures,
} from '../src/components/device/threeBoutiqueMaterials.ts'

describe('threeBoutiqueMaterials', () => {
  it('declares only bundled texture URLs', () => {
    assert.deepEqual(Object.keys(BOUTIQUE_TEXTURE_SPECS).sort(), [
      'brushedMetalRoughness',
      'mineralPlasterColor',
      'mineralPlasterHeight',
      'smokedOakColor',
      'smokedOakHeight',
      'wovenFabricHeight',
    ])
    for (const spec of Object.values(BOUTIQUE_TEXTURE_SPECS)) {
      assert.doesNotMatch(spec.url, /^https?:/)
      assert.match(spec.url, /assets\/textures\/boutique/)
    }
  })

  it('sets correct colour spaces and bounded anisotropy', () => {
    const colour = configureBoutiqueTexture('smokedOakColor', new THREE.Texture(), 16)
    const data = configureBoutiqueTexture('smokedOakHeight', new THREE.Texture(), 16)
    assert.equal(colour.colorSpace, THREE.SRGBColorSpace)
    assert.equal(data.colorSpace, THREE.NoColorSpace)
    assert.equal(colour.wrapS, THREE.RepeatWrapping)
    assert.equal(colour.wrapT, THREE.RepeatWrapping)
    assert.equal(colour.anisotropy, 8)
  })

  it('renders with fallback materials before any texture loads', () => {
    const library = createBoutiqueMaterialLibrary()
    const fabric = library.createFabricMaterial('#d45a48')
    assert.equal(library.floor.map, null)
    assert.equal(library.wall.map, null)
    assert.equal(fabric.bumpMap, null)
    assert.equal(fabric.color.getHexString(), 'd45a48')
    assert.equal(library.opticalGlass.transparent, true)
    library.dispose()
  })

  it('applies shared detail without replacing fabric colour', () => {
    const library = createBoutiqueMaterialLibrary()
    const fabric = library.createFabricMaterial('#4d86d9')
    library.applyTextures({
      smokedOakColor: new THREE.Texture(),
      wovenFabricHeight: new THREE.Texture(),
    })
    const lateFabric = library.createFabricMaterial('#8fb95a')
    assert.ok(library.floor.map)
    assert.deepEqual(library.floor.map?.repeat.toArray(), [4, 6])
    assert.ok(fabric.bumpMap)
    assert.ok(lateFabric.bumpMap)
    assert.equal(fabric.color.getHexString(), '4d86d9')
    assert.equal(lateFabric.color.getHexString(), '8fb95a')
    library.dispose()
  })

  it('returns null and one warning for each failed texture', async () => {
    const warnings: string[] = []
    const textures = await loadBoutiqueTextures(
      4,
      { loadAsync: async () => { throw new Error('missing') } },
      message => warnings.push(message),
    )
    assert.equal(Object.values(textures).filter(Boolean).length, 0)
    assert.equal(warnings.length, Object.keys(BOUTIQUE_TEXTURE_SPECS).length)
  })
})
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/threeBoutiqueMaterials.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `threeBoutiqueMaterials.ts`.

- [ ] **Step 3: Implement the material library**

Create `src/components/device/threeBoutiqueMaterials.ts` with this public shape and implementation:

```ts
import * as THREE from 'three'

export type BoutiqueTextureKey =
  | 'smokedOakColor'
  | 'smokedOakHeight'
  | 'mineralPlasterColor'
  | 'mineralPlasterHeight'
  | 'wovenFabricHeight'
  | 'brushedMetalRoughness'

type TextureSpec = { url: string; colour: boolean }

export const BOUTIQUE_TEXTURE_SPECS: Record<BoutiqueTextureKey, TextureSpec> = {
  smokedOakColor: { url: new URL('../../assets/textures/boutique/smoked-oak-color.png', import.meta.url).href, colour: true },
  smokedOakHeight: { url: new URL('../../assets/textures/boutique/smoked-oak-height.png', import.meta.url).href, colour: false },
  mineralPlasterColor: { url: new URL('../../assets/textures/boutique/mineral-plaster-color.png', import.meta.url).href, colour: true },
  mineralPlasterHeight: { url: new URL('../../assets/textures/boutique/mineral-plaster-height.png', import.meta.url).href, colour: false },
  wovenFabricHeight: { url: new URL('../../assets/textures/boutique/woven-fabric-height.png', import.meta.url).href, colour: false },
  brushedMetalRoughness: { url: new URL('../../assets/textures/boutique/brushed-metal-roughness.png', import.meta.url).href, colour: false },
}

export type BoutiqueTextureSet = Partial<Record<BoutiqueTextureKey, THREE.Texture | null>>
type TextureLoaderLike = { loadAsync(url: string): Promise<THREE.Texture> }

export function configureBoutiqueTexture(key: BoutiqueTextureKey, texture: THREE.Texture, maxAnisotropy: number) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = Math.max(1, Math.min(maxAnisotropy, 8))
  texture.colorSpace = BOUTIQUE_TEXTURE_SPECS[key].colour ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

export async function loadBoutiqueTextures(
  maxAnisotropy: number,
  loader: TextureLoaderLike = new THREE.TextureLoader(),
  warn: (message: string) => void = message => console.warn(message),
): Promise<BoutiqueTextureSet> {
  const pairs = await Promise.all(
    (Object.entries(BOUTIQUE_TEXTURE_SPECS) as Array<[BoutiqueTextureKey, TextureSpec]>).map(async ([key, spec]) => {
      try {
        return [key, configureBoutiqueTexture(key, await loader.loadAsync(spec.url), maxAnisotropy)] as const
      } catch {
        warn(`[three-boutique] texture failed: ${key}`)
        return [key, null] as const
      }
    }),
  )
  return Object.fromEntries(pairs) as BoutiqueTextureSet
}

export type BoutiqueMaterialLibrary = {
  floor: THREE.MeshStandardMaterial
  wall: THREE.MeshStandardMaterial
  wallInset: THREE.MeshStandardMaterial
  champagneMetal: THREE.MeshStandardMaterial
  darkMetal: THREE.MeshStandardMaterial
  plinthWood: THREE.MeshStandardMaterial
  coveGlow: THREE.MeshStandardMaterial
  cameraShell: THREE.MeshStandardMaterial
  opticalGlass: THREE.MeshPhysicalMaterial
  createFabricMaterial(colour: THREE.ColorRepresentation): THREE.MeshStandardMaterial
  applyTextures(textures: BoutiqueTextureSet): void
  dispose(): void
}

export function createBoutiqueMaterialLibrary(): BoutiqueMaterialLibrary {
  const materials = new Set<THREE.Material>()
  const sourceTextures = new Set<THREE.Texture>()
  const derivedTextures = new Set<THREE.Texture>()
  const fabrics = new Set<THREE.MeshStandardMaterial>()
  let activeFabricHeight: THREE.Texture | null = null
  const own = <T extends THREE.Material>(material: T) => { materials.add(material); return material }

  const floor = own(new THREE.MeshStandardMaterial({ color: '#8b5a3c', roughness: 0.58 }))
  const wall = own(new THREE.MeshStandardMaterial({ color: '#b8aea1', roughness: 0.92 }))
  const wallInset = own(new THREE.MeshStandardMaterial({ color: '#c8bfb3', roughness: 0.88 }))
  const champagneMetal = own(new THREE.MeshStandardMaterial({ color: '#b9965f', roughness: 0.3, metalness: 0.76 }))
  const darkMetal = own(new THREE.MeshStandardMaterial({ color: '#202327', roughness: 0.38, metalness: 0.72 }))
  const plinthWood = own(new THREE.MeshStandardMaterial({ color: '#785039', roughness: 0.52 }))
  const coveGlow = own(new THREE.MeshStandardMaterial({ color: '#fff0cf', emissive: '#ffd9a2', emissiveIntensity: 0.22, roughness: 0.7 }))
  coveGlow.toneMapped = false
  const cameraShell = own(new THREE.MeshStandardMaterial({ color: '#25282c', roughness: 0.62, metalness: 0.18 }))
  const opticalGlass = own(new THREE.MeshPhysicalMaterial({
    color: '#fff4dd', transparent: true, opacity: 0.48, roughness: 0.08,
    metalness: 0.04, transmission: 0.18, thickness: 0.02,
    clearcoat: 0.85, clearcoatRoughness: 0.1,
  }))

  const cloneForUse = (texture: THREE.Texture | null | undefined, x: number, y: number) => {
    if (!texture) return null
    const clone = texture.clone()
    clone.wrapS = THREE.RepeatWrapping
    clone.wrapT = THREE.RepeatWrapping
    clone.repeat.set(x, y)
    clone.needsUpdate = true
    derivedTextures.add(clone)
    return clone
  }

  const applyTextures = (textures: BoutiqueTextureSet) => {
    for (const texture of derivedTextures) texture.dispose()
    derivedTextures.clear()
    for (const texture of Object.values(textures)) if (texture) sourceTextures.add(texture)
    floor.map = cloneForUse(textures.smokedOakColor, 4, 6)
    floor.bumpMap = cloneForUse(textures.smokedOakHeight, 4, 6)
    floor.bumpScale = 0.035
    wall.map = cloneForUse(textures.mineralPlasterColor, 3, 2)
    wall.bumpMap = cloneForUse(textures.mineralPlasterHeight, 3, 2)
    wall.bumpScale = 0.018
    wallInset.map = cloneForUse(textures.mineralPlasterColor, 2, 2)
    wallInset.bumpMap = cloneForUse(textures.mineralPlasterHeight, 2, 2)
    wallInset.bumpScale = 0.012
    plinthWood.map = cloneForUse(textures.smokedOakColor, 2, 1)
    plinthWood.bumpMap = cloneForUse(textures.smokedOakHeight, 2, 1)
    plinthWood.bumpScale = 0.018
    const metalRoughness = cloneForUse(textures.brushedMetalRoughness, 6, 1)
    champagneMetal.roughnessMap = metalRoughness
    darkMetal.roughnessMap = metalRoughness
    activeFabricHeight = cloneForUse(textures.wovenFabricHeight, 12, 12)
    for (const fabric of fabrics) {
      fabric.bumpMap = activeFabricHeight
      fabric.bumpScale = 0.012
      fabric.needsUpdate = true
    }
    for (const material of materials) material.needsUpdate = true
  }

  const createFabricMaterial = (colour: THREE.ColorRepresentation) => {
    const material = own(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.84, metalness: 0, side: THREE.DoubleSide }))
    material.bumpMap = activeFabricHeight
    material.bumpScale = activeFabricHeight ? 0.012 : 0
    fabrics.add(material)
    return material
  }

  return {
    floor, wall, wallInset, champagneMetal, darkMetal, plinthWood,
    coveGlow, cameraShell, opticalGlass, createFabricMaterial, applyTextures,
    dispose() {
      for (const material of materials) material.dispose()
      for (const texture of derivedTextures) texture.dispose()
      for (const texture of sourceTextures) texture.dispose()
      materials.clear(); derivedTextures.clear(); sourceTextures.clear(); fabrics.clear()
      activeFabricHeight = null
    },
  }
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/threeBoutiqueMaterials.test.ts
```

Expected: 5 tests pass. Missing PNG files do not fail yet because this phase uses fallbacks.

- [ ] **Step 5: Commit**

```powershell
git add -- src/components/device/threeBoutiqueMaterials.ts tests/threeBoutiqueMaterials.test.ts
git diff --cached --name-status
git commit -m "feat: add boutique fallback materials"
```

### Task 2: Upgrade renderer colour management and environment

**Files:**

- Modify: `tests/threeLightingLayoutScene.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue:132-140, 340-365, 944-988, 2099-2148`
- Test: `tests/threeLightingLayoutScene.test.ts`

**Interfaces:**

- Consumes: `createBoutiqueMaterialLibrary()` and `BoutiqueMaterialLibrary`.
- Produces: sRGB/ACES rendering, PMREM room reflection, owned material and environment lifecycle.

- [ ] **Step 1: Add the failing renderer test**

Append to `tests/threeLightingLayoutScene.test.ts`:

```ts
it('uses colour-managed PBR rendering and disposes shared resources', () => {
  assert.match(component, /RoomEnvironment/)
  assert.match(component, /renderer\.outputColorSpace = THREE\.SRGBColorSpace/)
  assert.match(component, /renderer\.toneMapping = THREE\.ACESFilmicToneMapping/)
  assert.match(component, /renderer\.toneMappingExposure = 0\.92/)
  assert.match(component, /renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 2\)\)/)
  assert.match(component, /boutiqueMaterials = createBoutiqueMaterialLibrary\(\)/)
  assert.match(component, /environmentRenderTarget\?\.dispose\(\)/)
  assert.match(component, /boutiqueMaterials\?\.dispose\(\)/)
})
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: FAIL on `RoomEnvironment`.

- [ ] **Step 3: Add renderer imports and owned state**

Add imports:

```ts
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  createBoutiqueMaterialLibrary,
  type BoutiqueMaterialLibrary,
} from './threeBoutiqueMaterials'
```

Add state beside `renderer`:

```ts
let boutiqueMaterials: BoutiqueMaterialLibrary | null = null
let pmremGenerator: THREE.PMREMGenerator | null = null
let environmentRenderTarget: THREE.WebGLRenderTarget | null = null
```

- [ ] **Step 4: Configure renderer and PMREM**

After creating `renderer` in `initThreeScene()`:

```ts
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.92

pmremGenerator = new THREE.PMREMGenerator(renderer)
const roomEnvironment = new RoomEnvironment()
environmentRenderTarget = pmremGenerator.fromScene(roomEnvironment, 0.04)
roomEnvironment.dispose()
scene.environment = environmentRenderTarget.texture
boutiqueMaterials = createBoutiqueMaterialLibrary()
```

Keep the existing `renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))` line unchanged.

- [ ] **Step 5: Dispose shared resources**

Before `renderer.dispose()` in `cleanupThreeScene()`:

```ts
boutiqueMaterials?.dispose()
boutiqueMaterials = null
environmentRenderTarget?.dispose()
environmentRenderTarget = null
pmremGenerator?.dispose()
pmremGenerator = null
```

- [ ] **Step 6: Verify GREEN and build**

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts
npm run build
```

Expected: tests pass and build exits 0; the existing chunk-size warning is allowed.

- [ ] **Step 7: Commit**

```powershell
git add -- src/components/device/ThreeLightingLayout.vue tests/threeLightingLayoutScene.test.ts
git diff --cached --name-status
git commit -m "feat: add colour-managed Three rendering"
```

### Task 3: Rebuild the complete room and isolate cove lighting

**Files:**

- Modify: `tests/threeLightingLayoutScene.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue:365-380, 990-1167`
- Test: `tests/threeLightingLayoutScene.test.ts`

**Interfaces:**

- Consumes: fallback `boutiqueMaterials`, existing `displayWallZ`, scene and camera.
- Produces: `ARCHITECTURE_LIGHT_LAYER`, continuous floor, complete room, three bays, low cove light restricted to architecture.

- [ ] **Step 1: Add failing room and cove tests**

Append:

```ts
it('builds a complete room and keeps cove light away from products', () => {
  assert.match(component, /const ARCHITECTURE_LIGHT_LAYER = 1/)
  assert.match(component, /camera\.layers\.enable\(ARCHITECTURE_LIGHT_LAYER\)/)
  assert.match(component, /function enableArchitectureLight/)
  assert.match(component, /coveLight\.layers\.set\(ARCHITECTURE_LIGHT_LAYER\)/)
  assert.match(component, /new THREE\.PointLight\('#ffd9a2', 0\.28, 5\.4, 2\)/)
  assert.match(component, /new THREE\.PlaneGeometry\(8\.84, 6\.02/)
  assert.doesNotMatch(component, /const boardGeometry = new THREE\.BoxGeometry/)

  const shirtStart = component.indexOf('function createShirt(color: string) {')
  const shirtEnd = component.indexOf('\nfunction createCameraNode()', shirtStart)
  assert.ok(shirtStart >= 0 && shirtEnd > shirtStart)
  assert.doesNotMatch(component.slice(shirtStart, shirtEnd), /ARCHITECTURE_LIGHT_LAYER/)
})
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: FAIL on `ARCHITECTURE_LIGHT_LAYER`.

- [ ] **Step 3: Add architecture-only light layer**

Add beside scene constants:

```ts
const ARCHITECTURE_LIGHT_LAYER = 1

function enableArchitectureLight<T extends THREE.Object3D>(object: T) {
  object.layers.enable(ARCHITECTURE_LIGHT_LAYER)
  return object
}
```

After camera creation:

```ts
camera.layers.enable(ARCHITECTURE_LIGHT_LAYER)
```

- [ ] **Step 4: Replace `createBoutiqueFloor()`**

```ts
function createBoutiqueFloor() {
  if (!scene || !boutiqueMaterials) return

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 0.1, 6.1),
    new THREE.MeshStandardMaterial({ color: '#4d3327', roughness: 0.72 }),
  )
  foundation.position.set(0, -0.07, 0.35)
  foundation.receiveShadow = true

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8.84, 6.02, 1, 1),
    boutiqueMaterials.floor,
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, -0.012, 0.35)
  floor.receiveShadow = true

  const rearThreshold = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 0.035, 0.08),
    boutiqueMaterials.darkMetal,
  )
  rearThreshold.position.set(0, 0.018, -2.65)
  rearThreshold.castShadow = true
  scene.add(foundation, floor, rearThreshold)
}
```

- [ ] **Step 5: Replace the architectural shell in `createClothingDisplayWall()`**

Use these exact base meshes before the existing three-bay loop:

```ts
const wall = enableArchitectureLight(new THREE.Mesh(
  new THREE.BoxGeometry(8.9, 3.7, 0.12),
  boutiqueMaterials.wall,
))
wall.position.set(0, 1.85, displayWallZ - 0.07)
wall.receiveShadow = true
scene.add(wall)

for (const x of [-4.45, 4.45]) {
  const sideWall = enableArchitectureLight(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 3.35, 5.7),
    boutiqueMaterials.wall,
  ))
  sideWall.position.set(x, 1.675, 0.18)
  sideWall.receiveShadow = true
  scene.add(sideWall)
}

const ceilingReveal = enableArchitectureLight(new THREE.Mesh(
  new THREE.BoxGeometry(8.1, 0.11, 0.22),
  boutiqueMaterials.coveGlow,
))
ceilingReveal.position.set(0, 2.78, displayWallZ + 0.08)
scene.add(ceilingReveal)
```

Replace the old bay loop and all seven `textileLine` meshes with:

```ts
for (const x of [-2.25, 0, 2.25]) {
  const panel = enableArchitectureLight(new THREE.Mesh(
    new THREE.BoxGeometry(1.78, 2.02, 0.045),
    boutiqueMaterials.wallInset,
  ))
  panel.position.set(x, 1.5, displayWallZ + 0.035)
  panel.receiveShadow = true

  const topFrame = enableArchitectureLight(new THREE.Mesh(
    new THREE.BoxGeometry(1.86, 0.045, 0.055),
    boutiqueMaterials.champagneMetal,
  ))
  topFrame.position.set(x, 2.53, displayWallZ + 0.074)
  topFrame.castShadow = true
  const bottomFrame = topFrame.clone()
  bottomFrame.position.y = 0.47

  const leftFrame = enableArchitectureLight(new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 2.105, 0.055),
    boutiqueMaterials.champagneMetal,
  ))
  leftFrame.position.set(x - 0.91, 1.5, displayWallZ + 0.074)
  leftFrame.castShadow = true
  const rightFrame = leftFrame.clone()
  rightFrame.position.x = x + 0.91

  const rail = enableArchitectureLight(new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 1.34, 20),
    boutiqueMaterials.darkMetal,
  ))
  rail.position.set(x, 1.98, displayWallZ + 0.14)
  rail.rotation.z = Math.PI / 2
  rail.castShadow = true

  const leftBracket = enableArchitectureLight(new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.1),
    boutiqueMaterials.darkMetal,
  ))
  leftBracket.position.set(x - 0.67, 1.98, displayWallZ + 0.085)
  const rightBracket = leftBracket.clone()
  rightBracket.position.x = x + 0.67

  const plinth = enableArchitectureLight(new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.18, 0.32),
    boutiqueMaterials.plinthWood,
  ))
  plinth.position.set(x, 0.34, displayWallZ + 0.2)
  plinth.castShadow = true
  plinth.receiveShadow = true

  const plinthTop = enableArchitectureLight(new THREE.Mesh(
    new THREE.BoxGeometry(1.56, 0.018, 0.36),
    boutiqueMaterials.champagneMetal,
  ))
  plinthTop.position.set(x, 0.439, displayWallZ + 0.2)
  plinthTop.castShadow = true

  scene.add(
    panel,
    topFrame,
    bottomFrame,
    leftFrame,
    rightFrame,
    rail,
    leftBracket,
    rightBracket,
    plinth,
    plinthTop,
  )
}
```

- [ ] **Step 6: Replace `createWarmRetailLighting()`**

```ts
function createWarmRetailLighting() {
  if (!scene) return

  const ambient = new THREE.HemisphereLight('#fff8ec', '#5e4a3e', 0.58)
  const key = new THREE.DirectionalLight('#fff0d4', 0.46)
  key.position.set(-3.8, 4.8, 3.2)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -5
  key.shadow.camera.right = 5
  key.shadow.camera.top = 4
  key.shadow.camera.bottom = -1

  const coveLight = new THREE.PointLight('#ffd9a2', 0.28, 5.4, 2)
  coveLight.position.set(0, 2.74, displayWallZ + 0.5)
  coveLight.layers.set(ARCHITECTURE_LIGHT_LAYER)
  scene.add(ambient, key, coveLight)
}
```

Remove the old hemisphere light from `createStoreSpace()`. Keep per-device `THREE.SpotLight` creation and this mapping unchanged:

```ts
const intensity = 0.7 + lamp.brightness / 100 * 5.4
const opacity = 0.04 + lamp.brightness / 100 * 0.12
```

- [ ] **Step 7: Verify overall scene before any texture assets exist**

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts
npm run build
```

Expected: tests and build pass using only fallback materials. Browser screenshot must show a complete room and visible spotlight contrast before Phase 2 starts.

- [ ] **Step 8: Commit**

```powershell
git add -- src/components/device/ThreeLightingLayout.vue tests/threeLightingLayoutScene.test.ts
git diff --cached --name-status
git commit -m "feat: rebuild boutique room lighting"
```

## Phase 2: Texture and Model Detail

### Task 4: Generate local textures and connect asynchronous loading

**Files:**

- Create: six PNG files under `src/assets/textures/boutique/`
- Modify: `tests/threeBoutiqueMaterials.test.ts`
- Modify: `tests/threeLightingLayoutScene.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue`

**Interfaces:**

- Consumes: `BOUTIQUE_TEXTURE_SPECS`, `loadBoutiqueTextures()`, fallback `boutiqueMaterials`.
- Produces: six bundled texture assets and generation-safe asynchronous texture application.

- [ ] **Step 1: Add the failing asset test**

Add imports to `tests/threeBoutiqueMaterials.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
```

Append:

```ts
it('ships substantial local PNG files for every texture spec', () => {
  for (const [key, spec] of Object.entries(BOUTIQUE_TEXTURE_SPECS)) {
    const pathname = fileURLToPath(spec.url)
    assert.ok(existsSync(pathname), `${key} is missing`)
    const content = readFileSync(pathname)
    assert.equal(content.subarray(1, 4).toString('ascii'), 'PNG', `${key} is not PNG`)
    assert.ok(content.byteLength > 16_000, `${key} is unexpectedly small`)
  }
})
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/threeBoutiqueMaterials.test.ts`.

Expected: FAIL with `smokedOakColor is missing`.

- [ ] **Step 3: Generate assets using the imagegen skill**

Generate one square, seamless image per exact filename. Inspect each result with `view_image`; reject perspective, directional lighting, text, logos, object edges or visible seams.

| File | Exact prompt |
|---|---|
| `smoked-oak-color.png` | `Seamless square PBR base-color texture, smoked European oak floor boards, medium-dark warm brown, restrained board variation, orthographic surface scan, perfectly even flat lighting, no shadows, no highlights, no perspective, no objects, tileable edges, premium fashion boutique.` |
| `smoked-oak-height.png` | `Seamless square grayscale height map matching smoked European oak boards, white raised grain, black recessed pores and narrow seams, no colour, no lighting, no perspective, tileable edges, physically plausible low relief.` |
| `mineral-plaster-color.png` | `Seamless square PBR base-color texture of refined warm greige mineral plaster, quiet low-contrast clouding, subtle hand-trowelled character, even flat lighting, no shadows, no cracks, no perspective, tileable edges.` |
| `mineral-plaster-height.png` | `Seamless square grayscale height map for fine mineral plaster, extremely subtle trowel movement and pores, low relief, no large cracks, no colour, no lighting, no perspective, tileable edges.` |
| `woven-fabric-height.png` | `Seamless square grayscale height map of fine premium cotton jersey weave, dense tiny knitted loops, uniform scale, white raised threads and dark recesses, no colour, no folds, no lighting, no perspective, tileable edges.` |
| `brushed-metal-roughness.png` | `Seamless square grayscale roughness map for horizontally brushed champagne metal, fine continuous horizontal micro-scratches, medium gray base, no colour, no lighting, no perspective, tileable edges.` |

- [ ] **Step 4: Verify asset GREEN**

Run `node --test tests/threeBoutiqueMaterials.test.ts`.

Expected: 6 tests pass; each PNG is larger than 16 KB.

- [ ] **Step 5: Add failing texture-lifecycle assertions**

Append to `tests/threeLightingLayoutScene.test.ts`:

```ts
it('loads local textures after fallback scene creation and ignores stale loads', () => {
  assert.match(component, /let textureLoadGeneration = 0/)
  assert.match(component, /const loadGeneration = \+\+textureLoadGeneration/)
  assert.match(component, /loadBoutiqueTextures\(renderer\.capabilities\.getMaxAnisotropy\(\)\)/)
  assert.match(component, /loadGeneration !== textureLoadGeneration/)
  assert.match(component, /textureLoadGeneration \+= 1/)
})
```

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: FAIL on `textureLoadGeneration`.

- [ ] **Step 6: Connect async loading without delaying first render**

Add `loadBoutiqueTextures` to the material import and add:

```ts
let textureLoadGeneration = 0
```

After `createStoreSpace()`, `createTrack()`, `createMockLamps()`, and `createCameraNode()` have produced the fallback scene, add:

```ts
const loadGeneration = ++textureLoadGeneration
void loadBoutiqueTextures(renderer.capabilities.getMaxAnisotropy()).then((textures) => {
  if (loadGeneration !== textureLoadGeneration || !boutiqueMaterials) {
    for (const texture of Object.values(textures)) texture?.dispose()
    return
  }
  boutiqueMaterials.applyTextures(textures)
})
```

At the start of `cleanupThreeScene()` add:

```ts
textureLoadGeneration += 1
```

- [ ] **Step 7: Verify and commit**

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts
npm run build
git add -- src/assets/textures/boutique src/components/device/ThreeLightingLayout.vue tests/threeBoutiqueMaterials.test.ts tests/threeLightingLayoutScene.test.ts
git diff --cached --name-status
git commit -m "feat: add boutique surface textures"
```

### Task 5: Refine track, luminaires, garments, and camera

**Files:**

- Modify: `tests/threeLightingLayoutScene.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue:1168-1605, 1848-1938`
- Test: `tests/threeLightingLayoutScene.test.ts`, `tests/threeBoutiqueMaterials.test.ts`

**Interfaces:**

- Consumes: `darkMetal`, `champagneMetal`, `opticalGlass`, `cameraShell`, `createFabricMaterial()`.
- Produces: physically distinct track, lamp, reflector, lens, camera and dynamically coloured fabric.

- [ ] **Step 1: Add failing model-detail assertions**

Append:

```ts
it('uses boutique materials across every interactive model', () => {
  assert.match(component, /function requireBoutiqueMaterials\(\)/)
  assert.match(component, /materials\.darkMetal/)
  assert.match(component, /materials\.champagneMetal/)
  assert.match(component, /materials\.opticalGlass\.clone\(\)/)
  assert.match(component, /materials\.cameraShell/)
  assert.match(component, /materials\.createFabricMaterial\(baseColor\)/)
  assert.match(component, /const reflectorCup = new THREE\.Mesh/)
  assert.match(component, /const seamMaterial = materials\.createFabricMaterial/)
})
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/threeLightingLayoutScene.test.ts`.

Expected: FAIL on `requireBoutiqueMaterials`.

- [ ] **Step 3: Add safe access and apply track materials**

Add before `createTrack()`:

```ts
function requireBoutiqueMaterials() {
  if (!boutiqueMaterials) boutiqueMaterials = createBoutiqueMaterialLibrary()
  return boutiqueMaterials
}
```

At the top of `createTrack()` add `const materials = requireBoutiqueMaterials()` and replace its material assignments with:

```ts
railMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.18), materials.darkMetal)
railGrooveMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.024, 0.19), materials.darkMetal)
railHighlightMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.014, 0.028), materials.champagneMetal)
const supportMaterial = materials.darkMetal
```

Keep the existing blue `handleMaterial`, `dragType`, shadow flags and pickable registration exactly as they are.

At the top of `createLampObjects()` add `const materials = requireBoutiqueMaterials()` and replace the four shared assignments with:

```ts
const mountMaterial = materials.darkMetal
const hingeMaterial = materials.darkMetal
const darkMetalMaterial = materials.darkMetal
const rimMaterial = materials.champagneMetal
```

Use `materials.darkMetal` for `heatSinkFinMaterial`. Remove the obsolete module-scoped `sharedMountMaterial`, `sharedHingeMaterial`, `sharedDarkMetalMaterial`, and `sharedRimMaterial` declarations. Do not change any blue selection material or `userData.dragType` value.

- [ ] **Step 4: Add reflector and optical lens detail**

Before the aperture in `createLampObjects()`:

```ts
const reflectorCup = new THREE.Mesh(
  new THREE.CylinderGeometry(0.09, 0.19, 0.11, 40, 1, true),
  new THREE.MeshStandardMaterial({
    color: '#f2d8a3', roughness: 0.12, metalness: 0.92, side: THREE.DoubleSide,
  }),
)
reflectorCup.position.set(0, -0.34, 0)
reflectorCup.userData.ignorePickable = true

const lensMaterial = materials.opticalGlass.clone()
const lensGlass = new THREE.Mesh(
  new THREE.CylinderGeometry(0.187, 0.187, 0.022, 40),
  lensMaterial,
)
```

Add `reflectorCup` to `pitchBody.add(...)`. Keep aperture, selection ring, marker, spot, target, beam and hit testing unchanged.

- [ ] **Step 5: Apply fabric texture while preserving device colour**

At the top of `createShirt()` add `const materials = requireBoutiqueMaterials()`. Replace the two material constructors with:

```ts
const bodyMaterial = materials.createFabricMaterial(baseColor)
bodyMaterial.roughness = 0.84
const trimMaterial = materials.createFabricMaterial(trimColor)
trimMaterial.roughness = 0.88
```

After cuff creation add:

```ts
const seamMaterial = materials.createFabricMaterial(trimColor.clone().multiplyScalar(0.84))
seamMaterial.roughness = 0.9
const seamGeometry = new THREE.BoxGeometry(0.012, 0.58, 0.01)
const leftSeam = new THREE.Mesh(seamGeometry, seamMaterial)
leftSeam.position.set(-0.365, 0.34, 0.067)
leftSeam.rotation.z = -0.02
leftSeam.userData.shirtTrim = true
const rightSeam = leftSeam.clone()
rightSeam.position.x = 0.385
rightSeam.rotation.z = 0.02
shirt.add(leftSeam, rightSeam)
```

Keep `child.userData.shirtBody`, `child.userData.shirtTrim`, and `updateShirtColor()` as the only dynamic colour path.

- [ ] **Step 6: Refine the camera material only**

In `createCameraNode()`, add `const materials = requireBoutiqueMaterials()` and replace the body, lens and bracket construction with:

```ts
const body = new THREE.Mesh(
  new THREE.BoxGeometry(0.36, 0.22, 0.22),
  materials.cameraShell,
)
const lensMaterial = materials.opticalGlass.clone()
lensMaterial.color.set('#7aa7c7')
lensMaterial.emissive = new THREE.Color('#1d4ed8')
lensMaterial.emissiveIntensity = 0.08
const lens = new THREE.Mesh(
  new THREE.CylinderGeometry(0.07, 0.07, 0.09, 24),
  lensMaterial,
)
lens.position.set(0, 0, -0.155)
lens.rotation.x = Math.PI / 2
const bracket = new THREE.Mesh(
  new THREE.CylinderGeometry(0.026, 0.026, 0.38, 12),
  materials.cameraShell,
)
bracket.position.set(0, 0.31, 0)
```

Keep camera position, `lookAt()`, device fields and visibility unchanged.

- [ ] **Step 7: Bound shadow cost without changing light output**

Add:

```ts
const MAX_SHADOW_CASTING_SPOTS = 4
```

Add this helper after `syncLampObjectsWithState()`:

```ts
function updateSpotShadowBudget() {
  const orderedSlotIds = layoutState.lamps
    .filter(lamp => Boolean(lamp.sourceDeviceId || lamp.deviceId || lamp.chipId))
    .sort((a, b) => a.order - b.order)
    .map(lamp => lamp.slotId)
  const selectedId = selectedSlotId.value
  const priorityIds = selectedId
    ? [selectedId, ...orderedSlotIds.filter(slotId => slotId !== selectedId)]
    : orderedSlotIds
  const shadowIds = new Set(priorityIds.slice(0, MAX_SHADOW_CASTING_SPOTS))
  for (const [slotId, objects] of lampObjects) {
    objects.spot.castShadow = shadowIds.has(slotId)
  }
}
```

Call `updateSpotShadowBudget()` after the lamp-object creation loop in `syncLampObjectsWithState()`, at the end of `selectSlot()`, and at the end of `clearSelectedSlot()`. Remove the unconditional `spot.castShadow = true` in `createLampObjects()`. Do not change spotlight intensity, opacity, colour temperature, distance, angle or penumbra.

- [ ] **Step 8: Verify and commit**

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts
npm run build
git add -- src/components/device/ThreeLightingLayout.vue tests/threeLightingLayoutScene.test.ts
git diff --cached --name-status
git commit -m "feat: refine boutique model materials"
```

### Task 6: Add PC visual, contrast, and performance QA

**Files:**

- Create: `tests/threeBoutiqueQaHarness.test.ts`
- Create: `scripts/qa/threeBoutiqueSceneQa.mjs`
- Test: both files plus live browser run

**Interfaces:**

- Consumes: `THREE_QA_BASE_URL`, default `http://127.0.0.1:5178/smartlightdashboard`.
- Produces: 1080p/1440p screenshots and `output/playwright/three-boutique-qa.json`.

- [ ] **Step 1: Write the failing QA harness contract**

Create `tests/threeBoutiqueQaHarness.test.ts`:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('three boutique QA harness', () => {
  it('checks both PC viewports and the spotlight/cove contract', () => {
    const source = readFileSync(new URL('../scripts/qa/threeBoutiqueSceneQa.mjs', import.meta.url), 'utf8')
    assert.match(source, /width: 1920, height: 1080/)
    assert.match(source, /width: 2560, height: 1440/)
    assert.match(source, /spotlightContrast >= 1\.8/)
    assert.match(source, /floorVariance >= 45/)
    assert.match(source, /fps >= 45/)
    assert.match(source, /consoleErrors\.length === 0/)
    assert.match(source, /requestFailures\.length === 0/)
  })
})
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/threeBoutiqueQaHarness.test.ts`.

Expected: FAIL with `ENOENT` for the QA script.

- [ ] **Step 3: Implement the Playwright QA script**

Create `scripts/qa/threeBoutiqueSceneQa.mjs` with this complete content:

```js
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.THREE_QA_BASE_URL || 'http://127.0.0.1:5178/smartlightdashboard'
const outputDir = path.resolve('output/playwright')
await mkdir(outputDir, { recursive: true })

const devices = [
  { id: 101, chipId: 'qa-lamp-1', displayName: '新品展示区', deviceType: 'lamp', brightness: 72, temp: 3000, mainColorRgb: '#d45a48', online: true },
  { id: 102, chipId: 'qa-lamp-2', displayName: '新品展示区', deviceType: 'lamp', brightness: 88, temp: 4000, mainColorRgb: '#8fb95a', online: true },
]

function responseFor(url) {
  const pathname = new URL(url).pathname
  if (pathname === '/api/store/current') return { id: 'qa-store', userId: 'qa-user', storeName: '琥珀画廊验收店', storeStyle: 'HIGH_END', area: 80, province: '湖南省', city: '长沙市' }
  if (pathname === '/admin/weather/current') return { storeId: 'qa-store', temperature: 25, apparentTemperature: 26, humidity: 55, weatherCode: 1, weatherText: '多云' }
  if (pathname === '/admin/device/my-list') return devices
  if (pathname === '/admin/device/online-list') return devices.map(device => ({ chipId: device.chipId, online: true }))
  if (pathname.includes('/locate/')) return true
  if (pathname.includes('trend')) return { labels: [], datasets: [] }
  if (pathname.includes('duration') || pathname.includes('strategy')) return {}
  return []
}

const sampleCanvas = async (canvas) => canvas.evaluate((source) => {
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  const context = copy.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2D canvas unavailable')
  context.drawImage(source, 0, 0)
  const image = context.getImageData(0, 0, copy.width, copy.height)
  const luma = (x, y) => {
    const offset = (y * copy.width + x) * 4
    return image.data[offset] * 0.2126 + image.data[offset + 1] * 0.7152 + image.data[offset + 2] * 0.0722
  }
  const region = (x0, y0, x1, y1) => {
    const values = []
    for (let y = Math.floor(copy.height * y0); y < Math.floor(copy.height * y1); y += 3) {
      for (let x = Math.floor(copy.width * x0); x < Math.floor(copy.width * x1); x += 3) values.push(luma(x, y))
    }
    return values.sort((a, b) => a - b)
  }
  const mean = values => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
  const percentile = (values, ratio) => values[Math.min(values.length - 1, Math.floor(values.length * ratio))] || 0
  const cove = region(0.18, 0.2, 0.82, 0.32)
  const garments = region(0.14, 0.38, 0.86, 0.72)
  const floor = region(0.08, 0.72, 0.92, 0.96)
  const floorMean = mean(floor)
  return {
    spotlightContrast: percentile(garments, 0.95) / Math.max(1, mean(cove)),
    floorVariance: mean(floor.map(value => (value - floorMean) ** 2)),
  }
})

const measureFps = page => page.evaluate(() => new Promise((resolve) => {
  let frames = 0
  const started = performance.now()
  const step = (now) => {
    frames += 1
    if (now - started >= 1200) resolve(frames / ((now - started) / 1000))
    else requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}))

async function measureViewport(browser, viewport, suffix) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    localStorage.setItem('TOKEN', 'qa-token')
    localStorage.setItem('USER_INFO', JSON.stringify({ id: 'qa-user', storeConfigured: true }))
    localStorage.setItem('storeSetup', JSON.stringify({ configured: true }))
    localStorage.setItem('SMART_LIGHT_LAYOUT_ZONES', JSON.stringify([{ id: 'zone-a', name: '新品展示区' }]))
    localStorage.removeItem('SMART_LIGHT_THREE_ZONE_LAYOUTS_V1')
  })

  const page = await context.newPage()
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [] }
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
  })
  page.on('pageerror', error => diagnostics.pageErrors.push(String(error)))
  page.on('requestfailed', request => {
    diagnostics.requestFailures.push({ url: request.url(), error: request.failure()?.errorText || '' })
  })

  await page.route('https://api.genius.show/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, msg: 'ok', data: responseFor(route.request().url()) }),
  }))
  await page.routeWebSocket('wss://api.genius.show/**', socket => socket.onMessage(() => {}))

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const canvas = page.locator('.three-layout-viewport canvas')
  await canvas.waitFor({ state: 'visible' })
  await page.locator('.scene-slot-count').waitFor({ state: 'visible' })
  await page.waitForTimeout(900)

  await page.screenshot({ path: path.join(outputDir, `three-boutique-${suffix}.png`), fullPage: true })
  await canvas.screenshot({ path: path.join(outputDir, `three-boutique-canvas-${suffix}.png`) })

  const countText = (await page.locator('.scene-slot-count').textContent()) || ''
  const slotCount = Number(countText.match(/\d+/)?.[0] || 0)
  const pixels = await sampleCanvas(canvas)
  const fps = await measureFps(page)
  await context.close()
  return { viewport, slotCount, pixels, fps, diagnostics }
}

const browser = await chromium.launch({ headless: true })
const results = [
  await measureViewport(browser, { width: 1920, height: 1080 }, '1080'),
  await measureViewport(browser, { width: 2560, height: 1440 }, '1440'),
]
await browser.close()

const pass = results.every(({ slotCount, pixels, fps, diagnostics }) =>
  pixels.spotlightContrast >= 1.8
  && pixels.floorVariance >= 45
  && fps >= 45
  && diagnostics.consoleErrors.length === 0
  && diagnostics.pageErrors.length === 0
  && diagnostics.requestFailures.length === 0
  && slotCount === 2,
)

const report = { pass, results }
await writeFile(
  path.join(outputDir, 'three-boutique-qa.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify(report, null, 2))
if (!pass) process.exitCode = 1
```

- [ ] **Step 4: Verify harness GREEN**

Run `node --test tests/threeBoutiqueQaHarness.test.ts`.

Expected: 1 test passes.

- [ ] **Step 5: Run live PC QA**

Start Vite on port 5178, then run:

```powershell
node scripts/qa/threeBoutiqueSceneQa.mjs
```

Expected: JSON contains `"pass": true`; both spotlight contrast values are at least `1.8`; both FPS values are at least `45`; both slot counts equal `2`; diagnostics arrays are empty.

- [ ] **Step 6: Inspect screenshots**

Use `view_image` on both screenshots and verify the complete room, restrained cove, distinct warm/neutral spotlights, visible wood/plaster/fabric/metal/glass differences, no model intersections, and unchanged toolbar/context UI.

- [ ] **Step 7: Run full regression and commit QA**

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeBoutiqueQaHarness.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts
npm run build
git add -- scripts/qa/threeBoutiqueSceneQa.mjs tests/threeBoutiqueQaHarness.test.ts
git diff --cached --name-status
git commit -m "test: add boutique scene visual QA"
```

Do not add `output/playwright/` artifacts.

## Final Verification

Run from `E:\smart-light-front`:

```powershell
node --test tests/threeBoutiqueMaterials.test.ts tests/threeBoutiqueQaHarness.test.ts tests/threeLightingLayoutScene.test.ts tests/threeLightingWorkbenchUi.test.ts
npm run build
node scripts/qa/threeBoutiqueSceneQa.mjs
git status --short
```

Expected:

- all Node tests pass;
- build succeeds, with only the existing `>500 kB` chunk warning allowed;
- browser QA reports `pass: true` at both PC resolutions;
- two devices still produce exactly two lamp slots;
- no texture, page, console or request failures;
- `output/playwright/` remains untracked and is not committed;
- no unrelated user files are staged or committed;
- request code review before declaring implementation complete.
