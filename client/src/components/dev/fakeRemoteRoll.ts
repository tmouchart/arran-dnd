import { dice, playRemoteDiceRoll } from '../../composables/useDice3D'
import { DICE_PRESETS } from '../../data/dicePresets'
import { rollDie } from '../../utils/dice'

/**
 * Un jet distant bidon, pour régler l'animation sans second navigateur.
 * Nom et style tournent à chaque appel ; valeur forcée ou tirée au sort.
 *
 * `dropped` ajoute un dé lancé puis jeté (avantage) : il roule avec les autres
 * puis se rétracte et se ternit en se posant.
 */
const REMOTE_NAMES = ['Bracco', 'Nym', 'Orlane', 'Kaeliss', 'Théos']
let remoteIndex = 0

export function fakeRemoteRoll(value?: number, count = 1, dropped?: number) {
  const i = remoteIndex++ % REMOTE_NAMES.length
  const values = Array.from({ length: count }, () => value ?? rollDie(20))
  const rolls = dice(20, values, count > 1 ? 'libre' : 'weapon')
  if (dropped != null) rolls.push({ sides: 20, value: dropped, kind: 'weapon', dropped: true })
  playRemoteDiceRoll({
    actorName: REMOTE_NAMES[i],
    style: DICE_PRESETS[i % DICE_PRESETS.length].style,
    rolls,
  })
}
