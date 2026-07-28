import type {
  BoutiqueMaterialLibrary,
  BoutiqueTextureSet,
} from './threeBoutiqueMaterials'

type BoutiqueTextureTarget = Pick<BoutiqueMaterialLibrary, 'applyTextures'>

type BoutiqueTextureLoadCoordinatorOptions = {
  loader(): Promise<BoutiqueTextureSet>
  getLibrary(): BoutiqueTextureTarget | null
  warn(error: unknown): void
}

export type BoutiqueTextureLoadCoordinator = {
  start(): Promise<void>
  invalidate(): void
}

function disposeTextures(textures: BoutiqueTextureSet) {
  for (const texture of new Set(Object.values(textures))) texture?.dispose()
}

export function createBoutiqueTextureLoadCoordinator({
  loader,
  getLibrary,
  warn,
}: BoutiqueTextureLoadCoordinatorOptions): BoutiqueTextureLoadCoordinator {
  let generation = 0

  return {
    async start() {
      const loadGeneration = ++generation
      let textures: BoutiqueTextureSet

      try {
        textures = await loader()
      } catch (error) {
        if (loadGeneration === generation) warn(error)
        return
      }

      const library = getLibrary()
      if (loadGeneration !== generation || !library) {
        disposeTextures(textures)
        return
      }

      library.applyTextures(textures)
    },
    invalidate() {
      generation += 1
    },
  }
}
