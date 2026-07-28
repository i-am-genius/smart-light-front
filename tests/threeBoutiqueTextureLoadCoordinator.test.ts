import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as THREE from 'three'
import type { BoutiqueTextureSet } from '../src/components/device/threeBoutiqueMaterials.ts'
import { createBoutiqueTextureLoadCoordinator } from '../src/components/device/threeBoutiqueTextureLoadCoordinator.ts'

type Deferred<T> = {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function trackedTexture() {
  const texture = new THREE.Texture()
  let disposals = 0
  texture.addEventListener('dispose', () => { disposals += 1 })
  return { texture, disposalCount: () => disposals }
}

describe('createBoutiqueTextureLoadCoordinator', () => {
  it('applies the current load exactly once', async () => {
    const load = deferred<BoutiqueTextureSet>()
    const applied: BoutiqueTextureSet[] = []
    const coordinator = createBoutiqueTextureLoadCoordinator({
      loader: () => load.promise,
      getLibrary: () => ({ applyTextures: textures => applied.push(textures) }),
      warn: () => assert.fail('current successful load must not warn'),
    })
    const textures = { smokedOakColor: new THREE.Texture() }

    const completion = coordinator.start()
    load.resolve(textures)
    await completion
    await Promise.resolve()

    assert.deepEqual(applied, [textures])
  })

  it('disposes every stale texture exactly once after invalidation', async () => {
    const load = deferred<BoutiqueTextureSet>()
    const first = trackedTexture()
    const second = trackedTexture()
    const applied: BoutiqueTextureSet[] = []
    const coordinator = createBoutiqueTextureLoadCoordinator({
      loader: () => load.promise,
      getLibrary: () => ({ applyTextures: textures => applied.push(textures) }),
      warn: () => assert.fail('stale successful load must not warn'),
    })

    const completion = coordinator.start()
    coordinator.invalidate()
    load.resolve({
      smokedOakColor: first.texture,
      smokedOakHeight: second.texture,
    })
    await completion
    coordinator.invalidate()

    assert.equal(applied.length, 0)
    assert.equal(first.disposalCount(), 1)
    assert.equal(second.disposalCount(), 1)
  })

  it('absorbs rejections and warns only for the current generation', async () => {
    const currentLoad = deferred<BoutiqueTextureSet>()
    const staleLoad = deferred<BoutiqueTextureSet>()
    const loads = [currentLoad, staleLoad]
    const warnings: unknown[] = []
    const coordinator = createBoutiqueTextureLoadCoordinator({
      loader: () => loads.shift()!.promise,
      getLibrary: () => ({ applyTextures: () => assert.fail('rejected load must not apply') }),
      warn: error => warnings.push(error),
    })
    const currentError = new Error('current load failed')
    const staleError = new Error('stale load failed')

    const currentCompletion = coordinator.start()
    currentLoad.reject(currentError)
    await assert.doesNotReject(currentCompletion)

    const staleCompletion = coordinator.start()
    coordinator.invalidate()
    staleLoad.reject(staleError)
    await assert.doesNotReject(staleCompletion)

    assert.deepEqual(warnings, [currentError])
  })

  it('transfers valid texture ownership to the material library', async () => {
    const load = deferred<BoutiqueTextureSet>()
    const owned = trackedTexture()
    let accepted: BoutiqueTextureSet | null = null
    const coordinator = createBoutiqueTextureLoadCoordinator({
      loader: () => load.promise,
      getLibrary: () => ({ applyTextures: textures => { accepted = textures } }),
      warn: () => assert.fail('current successful load must not warn'),
    })
    const textures = { wovenFabricHeight: owned.texture }

    const completion = coordinator.start()
    load.resolve(textures)
    await completion
    coordinator.invalidate()

    assert.equal(accepted, textures)
    assert.equal(owned.disposalCount(), 0)
    owned.texture.dispose()
    assert.equal(owned.disposalCount(), 1)
  })
})
