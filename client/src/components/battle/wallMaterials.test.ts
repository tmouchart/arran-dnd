import { describe, it, expect } from 'vitest'
import {
  WALL_MATERIALS,
  DEFAULT_WALL_MATERIAL,
  findWallMaterial,
} from './wallMaterials'

describe('WALL_MATERIALS', () => {
  it('contient la pierre par défaut', () => {
    expect(WALL_MATERIALS.some((m) => m.id === DEFAULT_WALL_MATERIAL)).toBe(true)
  })

  it('a des ids uniques et valides côté serveur', () => {
    const ids = WALL_MATERIALS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Même contrainte que `MATERIAL_RE` dans `server/src/combats/obstacles.ts` :
    // un id qui ne la respecte pas ferait refuser tous les murs qui l'utilisent.
    for (const id of ids) expect(id).toMatch(/^[a-z-]{1,40}$/)
  })
})

describe('findWallMaterial', () => {
  it('trouve un matériau par son id', () => {
    expect(findWallMaterial('bois').id).toBe('bois')
  })

  it('retombe sur la pierre pour un id inconnu', () => {
    // Un mur tracé avec un matériau qu'on a supprimé depuis doit rester visible.
    expect(findWallMaterial('adamantium').id).toBe(DEFAULT_WALL_MATERIAL)
  })

  it('retombe sur la pierre quand il n’y a pas de matériau', () => {
    // Les murs tracés avant la palette n'en ont pas.
    expect(findWallMaterial(undefined).id).toBe(DEFAULT_WALL_MATERIAL)
    expect(findWallMaterial(null).id).toBe(DEFAULT_WALL_MATERIAL)
  })
})
