/**
 * Magical talents for the mystic profile family (Terres d’Arran — see knowledge/topics/magie.md).
 * Stored on the character as `mysticTalent` id; labels are player-facing (French).
 */

export type MysticTalentId =
  | 'detection'
  | 'flamme'
  | 'inspiration'
  | 'lumieres'
  | 'projectile'

export type ActionKind = 'limitée' | 'attaque' | 'gratuite'

export type AttackKind = 'contact' | 'distance' | 'magique' | null

export interface MysticTalentDef {
  id: MysticTalentId
  /** Short label without asterisk */
  name: string
  description: string
  actionType: ActionKind
  attackType: AttackKind
}

export const MYSTIC_TALENTS: MysticTalentDef[] = [
  {
    id: 'detection',
    name: 'Détection de la magie',
    description:
      'Action d’attaque ; concentration ; détecte inscriptions, aura ou objet magique dans la pièce (ou dans un rayon de 15 m). Ne consomme pas de PM ; ne bénéficie pas des effets de concentration liés aux sorts.',
    actionType: 'attaque',
    attackType: 'magique',
  },
  {
    id: 'flamme',
    name: 'Flamme',
    description:
      'Action gratuite : produit une flamme éclairant sur 5 m ; peut mettre le feu à des matières inflammables. Attaque de contact (action d’attaque) : 1d6 DM. Ne consomme pas de PM.',
    actionType: 'gratuite',
    attackType: null,
  },
  {
    id: 'inspiration',
    name: 'Inspiration',
    description:
      'Action d’attaque : +1 à tous les tests d’un allié à moins de 10 m pendant [2 + Mod. de SAG] tours. Au plus [1 + Mod. de INT] inspirations simultanées (minimum 1). Ne consomme pas de PM.',
    actionType: 'attaque',
    attackType: null,
  },
  {
    id: 'lumieres',
    name: 'Lumières dansantes',
    description:
      'Action de mouvement : invoque 3 sphères de lumière (rayon 20 m) autour du mystique ; durent tant que le mystique le souhaite ; tout DM rompt la concentration. Ne consomme pas de PM.',
    actionType: 'limitée',
    attackType: null,
  },
  {
    id: 'projectile',
    name: 'Projectile de force',
    description:
      'Action d’attaque : cible visible à moins de 50 m ; touche automatiquement ; 1d4 DM. Ne consomme pas de PM.',
    actionType: 'attaque',
    attackType: null,
  },
]

export const MYSTIC_TALENTS_BY_ID: Record<MysticTalentId, MysticTalentDef> = MYSTIC_TALENTS.reduce(
  (acc, t) => {
    acc[t.id] = t
    return acc
  },
  {} as Record<MysticTalentId, MysticTalentDef>,
)

export function isMysticTalentId(v: string): v is MysticTalentId {
  return v in MYSTIC_TALENTS_BY_ID
}
