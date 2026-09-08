import { dice, playRemoteDiceRoll } from '../../composables/useDice3D'
import { DICE_PRESETS } from '../../data/dicePresets'
import { rollDie } from '../../utils/dice'

/**
 * Un jet distant bidon, pour régler l'animation sans second navigateur.
 * Nom et style tournent à chaque appel ; valeur forcée ou tirée au sort.
 */
const REMOTE_NAMES = ['Bracco', 'Nym', 'Orlane', 'Kaeliss', 'Théos']
let remoteIndex = 0

export function fakeRemoteRoll(value?: number, count = 1) {
  const i = remoteIndex++ % REMOTE_NAMES.length
  const values = Array.from({ length: count }, () => value ?? rollDie(20))
  playRemoteDiceRoll({
    actorName: REMOTE_NAMES[i],
    style: DICE_PRESETS[i % DICE_PRESETS.length].style,
    rolls: dice(20, values, count > 1 ? 'libre' : 'weapon'),
  })
}
