import { ref } from 'vue'

const STORAGE_KEY = 'arran-dice-bar'

/** Barre de dés génériques, dépliable depuis la nav — accessible sur toutes les pages. */
const diceBarOpen = ref(localStorage.getItem(STORAGE_KEY) === '1')

export function useDiceBar() {
  function toggleDiceBar(open?: boolean): void {
    diceBarOpen.value = open ?? !diceBarOpen.value
    localStorage.setItem(STORAGE_KEY, diceBarOpen.value ? '1' : '0')
  }
  return { diceBarOpen, toggleDiceBar }
}
