import { describe, it, expect } from 'vitest'
import { rollResultClass } from './RollDetail.vue'

describe('rollResultClass', () => {
  it('lit le critique sur le dé gardé', () => {
    expect(rollResultClass({ attackDie: 20, attackSides: 20 })).toEqual({
      'roll-result--fumble': false,
      'roll-result--critical': true,
    })
    expect(rollResultClass({ attackDie: 1, attackSides: 20 })).toEqual({
      'roll-result--fumble': true,
      'roll-result--critical': false,
    })
  })

  it('ne peint rien quand le dé gardé est banal, même si un 1 a été écarté', () => {
    // Le dé écarté n'entre pas dans le calcul : seul `attackDie` compte.
    expect(rollResultClass({ attackDie: 14, attackSides: 20 })).toEqual({
      'roll-result--fumble': false,
      'roll-result--critical': false,
    })
  })

  it('garde l échec critique mais pas la réussite sur un dé non gradé', () => {
    expect(rollResultClass({ attackDie: 12, attackSides: 12 }, false)['roll-result--critical']).toBe(false)
    expect(rollResultClass({ attackDie: 1, attackSides: 12 }, false)['roll-result--fumble']).toBe(true)
  })
})
