import * as THREE from 'three'

export type BoutiqueTextureKey =
  | 'smokedOakColor'
  | 'smokedOakHeight'
  | 'mineralPlasterColor'
  | 'mineralPlasterHeight'
  | 'wovenFabricHeight'
  | 'brushedMetalRoughness'

type TextureSpec = { url: string; colour: boolean }

const FLOOR_FALLBACK_COLOUR = '#8b5a3c'
const WALL_FALLBACK_COLOUR = '#b8aea1'
const WALL_INSET_FALLBACK_COLOUR = '#c8bfb3'
const PLINTH_WOOD_FALLBACK_COLOUR = '#785039'
const CHAMPAGNE_METAL_FALLBACK_ROUGHNESS = 0.3
const DARK_METAL_FALLBACK_ROUGHNESS = 0.38
const FABRIC_DETAIL_SHADER_CACHE_KEY = 'boutique-fabric-neutral-detail-v1'
const FABRIC_DETAIL_MAP_FRAGMENT = /* glsl */`
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  float fabricDetail = clamp(1.0 + (sampledDiffuseColor.r - 0.56) * 1.8, 0.65, 1.35);
  diffuseColor.rgb *= fabricDetail;
  diffuseColor.a *= sampledDiffuseColor.a;
#endif
`

function configureFabricDetailShader(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      FABRIC_DETAIL_MAP_FRAGMENT,
    )
  }
  material.customProgramCacheKey = () => FABRIC_DETAIL_SHADER_CACHE_KEY
}

export const BOUTIQUE_TEXTURE_SPECS: Record<BoutiqueTextureKey, TextureSpec> = {
  smokedOakColor: {
    url: new URL('../../assets/textures/boutique/smoked-oak-color.png', import.meta.url).href,
    colour: true,
  },
  smokedOakHeight: {
    url: new URL('../../assets/textures/boutique/smoked-oak-height.png', import.meta.url).href,
    colour: false,
  },
  mineralPlasterColor: {
    url: new URL('../../assets/textures/boutique/mineral-plaster-color.png', import.meta.url).href,
    colour: true,
  },
  mineralPlasterHeight: {
    url: new URL('../../assets/textures/boutique/mineral-plaster-height.png', import.meta.url).href,
    colour: false,
  },
  wovenFabricHeight: {
    url: new URL('../../assets/textures/boutique/woven-fabric-height.png', import.meta.url).href,
    colour: false,
  },
  brushedMetalRoughness: {
    url: new URL('../../assets/textures/boutique/brushed-metal-roughness.png', import.meta.url).href,
    colour: false,
  },
}

export type BoutiqueTextureSet = Partial<Record<BoutiqueTextureKey, THREE.Texture | null>>

type TextureLoaderLike = {
  loadAsync(url: string): Promise<THREE.Texture>
}

export function configureBoutiqueTexture(
  key: BoutiqueTextureKey,
  texture: THREE.Texture,
  maxAnisotropy: number,
) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = Math.max(1, Math.min(maxAnisotropy, 8))
  texture.colorSpace = BOUTIQUE_TEXTURE_SPECS[key].colour
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

export async function loadBoutiqueTextures(
  maxAnisotropy: number,
  loader: TextureLoaderLike = new THREE.TextureLoader(),
  warn: (message: string) => void = message => console.warn(message),
): Promise<BoutiqueTextureSet> {
  const pairs = await Promise.all(
    (Object.entries(BOUTIQUE_TEXTURE_SPECS) as Array<[BoutiqueTextureKey, TextureSpec]>).map(
      async ([key, spec]) => {
        try {
          return [
            key,
            configureBoutiqueTexture(key, await loader.loadAsync(spec.url), maxAnisotropy),
          ] as const
        } catch {
          warn(`[three-boutique] texture failed: ${key}`)
          return [key, null] as const
        }
      },
    ),
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
  ownsMaterial(material: THREE.Material): boolean
  releaseMaterial(material: THREE.Material): boolean
  applyTextures(textures: BoutiqueTextureSet): void
  dispose(): void
}

export function createBoutiqueMaterialLibrary(): BoutiqueMaterialLibrary {
  const materials = new Set<THREE.Material>()
  const sourceTextures = new Set<THREE.Texture>()
  const derivedTextures = new Set<THREE.Texture>()
  const fabrics = new Set<THREE.MeshStandardMaterial>()
  let activeFabricHeight: THREE.Texture | null = null

  const own = <T extends THREE.Material>(material: T) => {
    materials.add(material)
    return material
  }

  const floor = own(new THREE.MeshStandardMaterial({ color: FLOOR_FALLBACK_COLOUR, roughness: 0.58 }))
  const wall = own(new THREE.MeshStandardMaterial({ color: WALL_FALLBACK_COLOUR, roughness: 0.92 }))
  const wallInset = own(new THREE.MeshStandardMaterial({ color: WALL_INSET_FALLBACK_COLOUR, roughness: 0.88 }))
  const champagneMetal = own(new THREE.MeshStandardMaterial({
    color: '#b9965f',
    roughness: CHAMPAGNE_METAL_FALLBACK_ROUGHNESS,
    metalness: 0.76,
  }))
  const darkMetal = own(new THREE.MeshStandardMaterial({
    color: '#202327',
    roughness: DARK_METAL_FALLBACK_ROUGHNESS,
    metalness: 0.72,
  }))
  const plinthWood = own(new THREE.MeshStandardMaterial({
    color: PLINTH_WOOD_FALLBACK_COLOUR,
    roughness: 0.52,
  }))
  const coveGlow = own(new THREE.MeshStandardMaterial({
    color: '#fff0cf',
    emissive: '#ffd9a2',
    emissiveIntensity: 0.22,
    roughness: 0.7,
  }))
  coveGlow.toneMapped = true
  const cameraShell = own(new THREE.MeshStandardMaterial({
    color: '#25282c',
    roughness: 0.62,
    metalness: 0.18,
  }))
  const opticalGlass = own(new THREE.MeshPhysicalMaterial({
    color: '#fff4dd',
    transparent: true,
    opacity: 0.48,
    roughness: 0.08,
    metalness: 0.04,
    transmission: 0.18,
    thickness: 0.02,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
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
    for (const texture of Object.values(textures)) {
      if (texture) sourceTextures.add(texture)
    }

    floor.map = cloneForUse(textures.smokedOakColor, 2, 3)
    floor.color.set(floor.map ? '#ffffff' : FLOOR_FALLBACK_COLOUR)
    floor.bumpMap = cloneForUse(textures.smokedOakHeight, 2, 3)
    floor.bumpScale = 0.035
    wall.map = cloneForUse(textures.mineralPlasterColor, 3, 2)
    wall.color.set(wall.map ? '#ffffff' : WALL_FALLBACK_COLOUR)
    wall.bumpMap = cloneForUse(textures.mineralPlasterHeight, 3, 2)
    wall.bumpScale = 0.018
    wallInset.map = cloneForUse(textures.mineralPlasterColor, 2, 2)
    wallInset.color.set(wallInset.map ? '#ffffff' : WALL_INSET_FALLBACK_COLOUR)
    wallInset.bumpMap = cloneForUse(textures.mineralPlasterHeight, 2, 2)
    wallInset.bumpScale = 0.012
    plinthWood.map = cloneForUse(textures.smokedOakColor, 1, 1)
    plinthWood.color.set(plinthWood.map ? '#ffffff' : PLINTH_WOOD_FALLBACK_COLOUR)
    plinthWood.bumpMap = cloneForUse(textures.smokedOakHeight, 1, 1)
    plinthWood.bumpScale = 0.018

    const metalRoughness = cloneForUse(textures.brushedMetalRoughness, 6, 1)
    champagneMetal.roughnessMap = metalRoughness
    darkMetal.roughnessMap = metalRoughness
    champagneMetal.roughness = metalRoughness ? 1 : CHAMPAGNE_METAL_FALLBACK_ROUGHNESS
    darkMetal.roughness = metalRoughness ? 1 : DARK_METAL_FALLBACK_ROUGHNESS

    activeFabricHeight = cloneForUse(textures.wovenFabricHeight, 0.75, 0.75)
    for (const fabric of fabrics) {
      fabric.map = activeFabricHeight
      fabric.bumpMap = activeFabricHeight
      fabric.bumpScale = activeFabricHeight ? 0.012 : 0
      fabric.needsUpdate = true
    }
    for (const material of materials) material.needsUpdate = true
  }

  const createFabricMaterial = (colour: THREE.ColorRepresentation) => {
    const material = own(new THREE.MeshStandardMaterial({
      color: colour,
      roughness: 0.84,
      metalness: 0,
      side: THREE.DoubleSide,
    }))
    configureFabricDetailShader(material)
    material.map = activeFabricHeight
    material.bumpMap = activeFabricHeight
    material.bumpScale = activeFabricHeight ? 0.012 : 0
    fabrics.add(material)
    return material
  }

  const ownsMaterial = (material: THREE.Material) => materials.has(material)

  const releaseMaterial = (material: THREE.Material) => {
    if (!(material instanceof THREE.MeshStandardMaterial) || !fabrics.delete(material)) {
      return false
    }
    materials.delete(material)
    material.dispose()
    return true
  }

  return {
    floor,
    wall,
    wallInset,
    champagneMetal,
    darkMetal,
    plinthWood,
    coveGlow,
    cameraShell,
    opticalGlass,
    createFabricMaterial,
    ownsMaterial,
    releaseMaterial,
    applyTextures,
    dispose() {
      for (const material of materials) material.dispose()
      for (const texture of derivedTextures) texture.dispose()
      for (const texture of sourceTextures) texture.dispose()
      materials.clear()
      derivedTextures.clear()
      sourceTextures.clear()
      fabrics.clear()
      activeFabricHeight = null
    },
  }
}
