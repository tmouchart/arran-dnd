/**
 * Petit bestiaire de dev, autonome. Le vrai catalogue vit côté client
 * (`client/src/data/monstersCatalog.ts`) ; le dupliquer entièrement ici n'aurait
 * aucun intérêt — on veut juste de quoi remplir un combat bidon.
 */
export interface DevMonster {
  name: string
  nc: number
  def: number
  pv: number
  init: number
  statFor: number
  statDex: number
  statCon: number
  statInt: number
  statSag: number
  statCha: number
  attacks: { name: string; bonus: number; damage: string; range?: number }[]
  abilities: { name: string; description: string }[]
  description: string
}

export const DEV_BESTIARY: DevMonster[] = [
  {
    name: 'Gobelin fouisseur', nc: 0.5, def: 13, pv: 7, init: 12,
    statFor: -1, statDex: 2, statCon: 0, statInt: 0, statSag: 0, statCha: -1,
    attacks: [{ name: 'Dague rouillée', bonus: 3, damage: '1d4+1' }],
    abilities: [{ name: 'Lâche', description: 'Fuit dès que la moitié du groupe est tombée.' }],
    description: 'Petit, sale, et beaucoup trop confiant.',
  },
  {
    name: 'Loup des landes', nc: 1, def: 14, pv: 13, init: 14,
    statFor: 1, statDex: 3, statCon: 1, statInt: -3, statSag: 1, statCha: -2,
    attacks: [{ name: 'Morsure', bonus: 4, damage: '1d6+2' }],
    abilities: [{ name: 'Meute', description: '+2 en attaque si un allié est au contact de la même cible.' }],
    description: 'Maigre, gris, et il n\'est jamais seul.',
  },
  {
    name: 'Archer squelette', nc: 1, def: 12, pv: 10, init: 9,
    statFor: 0, statDex: 2, statCon: 0, statInt: -4, statSag: 0, statCha: -4,
    attacks: [{ name: 'Arc court', bonus: 3, damage: '1d6', range: 30 }],
    abilities: [{ name: 'Os secs', description: 'Immunisé au poison, vulnérable aux dégâts contondants.' }],
    description: 'Il visait déjà mal de son vivant.',
  },
  {
    name: 'Ogre bilieux', nc: 3, def: 15, pv: 34, init: 6,
    statFor: 4, statDex: -1, statCon: 3, statInt: -2, statSag: 0, statCha: -2,
    attacks: [{ name: 'Gourdin clouté', bonus: 6, damage: '2d6+4' }],
    abilities: [{ name: 'Coup ample', description: 'Touche deux cibles adjacentes sur un jet réussi de 5+.' }],
    description: 'Lent, mais on ne le rate pas deux fois.',
  },
  {
    name: 'Sorcière des tourbes', nc: 4, def: 14, pv: 26, init: 11,
    statFor: 0, statDex: 1, statCon: 1, statInt: 3, statSag: 2, statCha: 2,
    attacks: [{ name: 'Trait putride', bonus: 5, damage: '2d6', range: 20 }],
    abilities: [{ name: 'Brume', description: 'Une fois par combat : -4 aux attaques à distance visant ses alliés.' }],
    description: 'Elle parle à la boue, et la boue répond.',
  },
  {
    name: 'Chef de guerre orque', nc: 5, def: 17, pv: 45, init: 10,
    statFor: 4, statDex: 1, statCon: 3, statInt: 0, statSag: 1, statCha: 2,
    attacks: [
      { name: 'Hache à deux mains', bonus: 8, damage: '1d12+4' },
      { name: 'Javelot', bonus: 6, damage: '1d6+4', range: 15 },
    ],
    abilities: [{ name: 'Cri de guerre', description: 'Ses alliés gagnent +2 en attaque pendant un round.' }],
    description: 'Il porte les dents de ses prédécesseurs en collier.',
  },
]
