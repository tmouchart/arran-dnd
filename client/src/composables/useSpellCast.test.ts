import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { VoieFamily } from '../data/voies'
import { createDefaultCharacter } from './useCharacter'
import { useSpellCast } from './useSpellCast'

function setup(family: VoieFamily, mp: number, hp: number) {
  const character = ref({ ...createDefaultCharacter(), mpCurrent: mp, hpCurrent: hp })
  const { payPm } = useSpellCast(character, ref(family))
  return { character, payPm }
}

describe('useSpellCast.payPm', () => {
  it('débite les PM quand il y en a assez', () => {
    const { character, payPm } = setup('mystiques', 10, 20)
    expect(payPm(4)).toEqual({ pm: 4, hpBurned: 0 })
    expect(character.value.mpCurrent).toBe(6)
    expect(character.value.hpCurrent).toBe(20)
  })

  it('un coût nul ne touche à rien', () => {
    const { character, payPm } = setup('mystiques', 3, 20)
    expect(payPm(0)).toEqual({ pm: 0, hpBurned: 0 })
    expect(character.value.mpCurrent).toBe(3)
  })

  it('brûlure de magie : 1 PV par PM manquant pour un mystique', () => {
    const { character, payPm } = setup('mystiques', 1, 20)
    expect(payPm(4)).toEqual({ pm: 1, hpBurned: 3 })
    expect(character.value.mpCurrent).toBe(0)
    expect(character.value.hpCurrent).toBe(17)
  })

  it('brûlure de magie : 2 PV par PM manquant pour un combattant', () => {
    const { character, payPm } = setup('combattants', 1, 20)
    expect(payPm(4)).toEqual({ pm: 1, hpBurned: 6 })
    expect(character.value.hpCurrent).toBe(14)
  })

  it('les PV ne passent pas sous 0', () => {
    const { character, payPm } = setup('mystiques', 0, 2)
    payPm(5)
    expect(character.value.hpCurrent).toBe(0)
  })
})
