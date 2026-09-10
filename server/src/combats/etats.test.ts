import { describe, it, expect } from 'vitest'
import { ETAT_IDS, isEtatId } from './etats.js'

/**
 * La liste du catalogue client (`client/src/data/etats.ts`), recopiée en dur.
 *
 * Un test du workspace serveur ne peut pas importer un fichier du workspace
 * client (tsconfig et build séparés). On duplique donc volontairement : le jour
 * où quelqu'un ajoute un état d'un seul côté, c'est ce test qui l'attrape.
 */
const IDS_CLIENT = [
  'aveugle', 'affaibli', 'etourdi', 'immobilise', 'paralyse', 'ralenti',
  'renverse', 'surpris', 'desarme', 'bloque', 'repousse', 'diversion', 'menace',
]

describe('les ids côté serveur', () => {
  it('sont exactement ceux du catalogue client, dans le même ordre', () => {
    expect([...ETAT_IDS]).toEqual(IDS_CLIENT)
  })

  it('sont uniques', () => {
    expect(new Set(ETAT_IDS).size).toBe(ETAT_IDS.length)
  })
})

describe('isEtatId', () => {
  it('accepte chaque id de la liste', () => {
    for (const id of ETAT_IDS) expect(isEtatId(id)).toBe(true)
  })

  it("rejette ce qui n'est pas un id", () => {
    expect(isEtatId('empoisonne')).toBe(false)
    expect(isEtatId('')).toBe(false)
    expect(isEtatId(0)).toBe(false)
    expect(isEtatId(null)).toBe(false)
    expect(isEtatId(undefined)).toBe(false)
    expect(isEtatId(['renverse'])).toBe(false)
  })
})
