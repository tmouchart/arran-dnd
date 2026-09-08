import { dice, playRemoteDiceRoll } from '../../composables/useDice3D'
import { DICE_COLORS } from '../../data/diceColors'
import { rollDie } from '../../utils/dice'

/**
 * Un jet distant bidon, pour régler l'animation sans second navigateur.
 * Nom et couleur tournent à chaque appel ; valeur forcée ou tirée au sort.
 */
const REMOTE_NAMES = ['Bracco', 'Nym', 'Orlane', 'Kaeliss', 'Théos']
let remoteIndex = 0

export function fakeRemoteRoll(value?: number, count = 1) {
  const i = remoteIndex++ % REMOTE_NAMES.length
  const values = Array.from({ length: count }, () => value ?? rollDie(20))
  playRemoteDiceRoll({
    actorName: REMOTE_NAMES[i],
    color: DICE_COLORS[i].hex,
    rolls: dice(20, values, count > 1 ? 'libre' : 'weapon'),
  })
}
