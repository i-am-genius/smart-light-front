import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import {
  BOUTIQUE_TEXTURE_SPECS,
  configureBoutiqueTexture,
  createBoutiqueMaterialLibrary,
  loadBoutiqueTextures,
  type BoutiqueTextureKey,
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

  it('ships substantial local PNG files for every texture spec', () => {
    for (const [key, spec] of Object.entries(BOUTIQUE_TEXTURE_SPECS)) {
      const pathname = fileURLToPath(spec.url)
      assert.ok(existsSync(pathname), `${key} is missing`)
      const content = readFileSync(pathname)
      assert.deepEqual(
        content.subarray(0, 8),
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        `${key} is not PNG`,
      )
      assert.ok(content.byteLength > 16_000, `${key} is unexpectedly small`)
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
    assert.equal(library.floor.color.getHexString(), '8b5a3c')
    assert.equal(library.wall.color.getHexString(), 'b8aea1')
    assert.equal(library.wallInset.color.getHexString(), 'c8bfb3')
    assert.equal(library.plinthWood.color.getHexString(), '785039')
    assert.equal(library.champagneMetal.roughness, 0.3)
    assert.equal(library.darkMetal.roughness, 0.38)
    assert.equal(fabric.bumpMap, null)
    assert.equal(fabric.color.getHexString(), 'd45a48')
    assert.equal(library.opticalGlass.transparent, true)
    library.dispose()
  })

  it('keeps cove glow as a tone-mapped emissive-only visual strip', () => {
    const library = createBoutiqueMaterialLibrary()

    assert.equal(library.coveGlow.toneMapped, true)
    assert.equal(library.coveGlow.emissiveIntensity, 0.22)
    assert.notEqual(library.coveGlow.emissive.getHex(), 0)
    assert.equal(library.coveGlow.map, null)

    library.dispose()
  })

  it('reports ownership for shared and dynamic materials only', () => {
    const library = createBoutiqueMaterialLibrary()
    const fabric = library.createFabricMaterial('#d45a48')
    const external = new THREE.MeshStandardMaterial()

    assert.equal(typeof library.ownsMaterial, 'function')
    assert.equal(library.ownsMaterial(library.floor), true)
    assert.equal(library.ownsMaterial(fabric), true)
    assert.equal(library.ownsMaterial(external), false)

    library.dispose()
    external.dispose()
  })

  it('releases per-instance fabric materials exactly once without releasing shared materials', () => {
    const library = createBoutiqueMaterialLibrary()
    const fabric = library.createFabricMaterial('#4d86d9')
    let floorDisposals = 0
    let fabricDisposals = 0
    library.floor.addEventListener('dispose', () => { floorDisposals += 1 })
    fabric.addEventListener('dispose', () => { fabricDisposals += 1 })

    assert.equal(typeof library.releaseMaterial, 'function')
    assert.equal(library.releaseMaterial(library.floor), false)
    assert.equal(library.releaseMaterial(fabric), true)
    assert.equal(library.ownsMaterial(fabric), false)
    assert.equal(library.releaseMaterial(fabric), false)
    assert.equal(fabricDisposals, 1)
    assert.equal(floorDisposals, 0)

    library.dispose()
    library.dispose()
    assert.equal(fabricDisposals, 1)
    assert.equal(floorDisposals, 1)
  })

  it('applies shared detail without replacing fabric colour', () => {
    const library = createBoutiqueMaterialLibrary()
    const fabric = library.createFabricMaterial('#4d86d9')
    library.applyTextures({
      smokedOakColor: new THREE.Texture(),
      mineralPlasterColor: new THREE.Texture(),
      wovenFabricHeight: new THREE.Texture(),
      brushedMetalRoughness: new THREE.Texture(),
    })
    const lateFabric = library.createFabricMaterial('#8fb95a')
    assert.ok(library.floor.map)
    assert.deepEqual(library.floor.map?.repeat.toArray(), [2, 3])
    assert.deepEqual(library.plinthWood.map?.repeat.toArray(), [1, 1])
    assert.deepEqual(library.wall.map?.repeat.toArray(), [3, 2])
    assert.deepEqual(library.wallInset.map?.repeat.toArray(), [2, 2])
    assert.deepEqual(library.champagneMetal.roughnessMap?.repeat.toArray(), [6, 1])
    assert.equal(fabric.map, fabric.bumpMap)
    assert.equal(lateFabric.map, lateFabric.bumpMap)
    assert.equal(lateFabric.map, fabric.map)
    assert.ok(fabric.bumpMap)
    assert.ok(lateFabric.bumpMap)
    assert.deepEqual(fabric.bumpMap?.repeat.toArray(), [0.75, 0.75])
    assert.deepEqual(fabric.bumpMap?.offset.toArray(), [0, 0])
    assert.equal(fabric.customProgramCacheKey(), 'boutique-fabric-neutral-detail-v1')
    const shader = { fragmentShader: '#include <map_fragment>' }
    fabric.onBeforeCompile(shader as never, {} as never)
    assert.match(shader.fragmentShader, /sampledDiffuseColor\.r - 0\.56/)
    assert.match(shader.fragmentShader, /\* 1\.8/)
    assert.match(shader.fragmentShader, /clamp\([\s\S]*0\.65, 1\.35\)/)
    assert.doesNotMatch(shader.fragmentShader, /diffuseColor \*= sampledDiffuseColor/)
    assert.equal(library.floor.color.getHexString(), 'ffffff')
    assert.equal(library.wall.color.getHexString(), 'ffffff')
    assert.equal(library.wallInset.color.getHexString(), 'ffffff')
    assert.equal(library.plinthWood.color.getHexString(), 'ffffff')
    assert.equal(library.champagneMetal.roughness, 1)
    assert.equal(library.darkMetal.roughness, 1)
    assert.equal(fabric.color.getHexString(), '4d86d9')
    assert.equal(lateFabric.color.getHexString(), '8fb95a')
    library.dispose()
  })

  it('restores fallback factors when mapped textures disappear', () => {
    const library = createBoutiqueMaterialLibrary()
    const fabric = library.createFabricMaterial('#4d86d9')
    library.applyTextures({
      smokedOakColor: new THREE.Texture(),
      mineralPlasterColor: new THREE.Texture(),
      wovenFabricHeight: new THREE.Texture(),
      brushedMetalRoughness: new THREE.Texture(),
    })

    library.applyTextures({})

    assert.equal(library.floor.color.getHexString(), '8b5a3c')
    assert.equal(library.wall.color.getHexString(), 'b8aea1')
    assert.equal(library.wallInset.color.getHexString(), 'c8bfb3')
    assert.equal(library.plinthWood.color.getHexString(), '785039')
    assert.equal(library.champagneMetal.roughness, 0.3)
    assert.equal(library.darkMetal.roughness, 0.38)
    assert.equal(fabric.map, null)
    assert.equal(fabric.bumpMap, null)
    assert.equal(fabric.bumpScale, 0)
    library.dispose()
  })

  it('disposes owned materials and source or derived textures exactly once', () => {
    const library = createBoutiqueMaterialLibrary()
    const fabric = library.createFabricMaterial('#4d86d9')
    const sourceTextures = {
      smokedOakColor: new THREE.Texture(),
      smokedOakHeight: new THREE.Texture(),
      mineralPlasterColor: new THREE.Texture(),
      mineralPlasterHeight: new THREE.Texture(),
      wovenFabricHeight: new THREE.Texture(),
      brushedMetalRoughness: new THREE.Texture(),
    }
    library.applyTextures(sourceTextures)

    const ownedMaterials = [
      library.floor,
      library.wall,
      library.wallInset,
      library.champagneMetal,
      library.darkMetal,
      library.plinthWood,
      library.coveGlow,
      library.cameraShell,
      library.opticalGlass,
      fabric,
    ]
    const derivedTextures = new Set([
      library.floor.map,
      library.floor.bumpMap,
      library.wall.map,
      library.wall.bumpMap,
      library.wallInset.map,
      library.wallInset.bumpMap,
      library.plinthWood.map,
      library.plinthWood.bumpMap,
      library.champagneMetal.roughnessMap,
      library.darkMetal.roughnessMap,
      fabric.bumpMap,
    ].filter((texture): texture is THREE.Texture => texture !== null))
    assert.equal(derivedTextures.size, 10)

    const resources = [
      ...ownedMaterials,
      ...Object.values(sourceTextures),
      ...derivedTextures,
    ]
    const disposalCounts = resources.map(resource => {
      let count = 0
      resource.addEventListener('dispose', () => { count += 1 })
      return () => count
    })

    library.dispose()
    library.dispose()

    assert.deepEqual(disposalCounts.map(readCount => readCount()), resources.map(() => 1))
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

  it('keeps successful textures configured when one texture fails', async () => {
    const failedKey: BoutiqueTextureKey = 'mineralPlasterHeight'
    const failedUrl = BOUTIQUE_TEXTURE_SPECS[failedKey].url
    const loadedByUrl = new Map<string, THREE.Texture>()
    const warnings: string[] = []
    const textures = await loadBoutiqueTextures(
      16,
      {
        loadAsync: async url => {
          if (url === failedUrl) throw new Error('missing')
          const texture = new THREE.Texture()
          loadedByUrl.set(url, texture)
          return texture
        },
      },
      message => warnings.push(message),
    )

    assert.equal(textures[failedKey], null)
    assert.deepEqual(warnings, [`[three-boutique] texture failed: ${failedKey}`])
    for (const [key, spec] of Object.entries(BOUTIQUE_TEXTURE_SPECS) as Array<[
      BoutiqueTextureKey,
      { url: string; colour: boolean },
    ]>) {
      if (key === failedKey) continue
      const texture = textures[key]
      assert.ok(texture)
      assert.equal(texture, loadedByUrl.get(spec.url))
      assert.equal(texture.wrapS, THREE.RepeatWrapping)
      assert.equal(texture.wrapT, THREE.RepeatWrapping)
      assert.equal(texture.anisotropy, 8)
      assert.equal(texture.colorSpace, spec.colour ? THREE.SRGBColorSpace : THREE.NoColorSpace)
    }
  })
})
