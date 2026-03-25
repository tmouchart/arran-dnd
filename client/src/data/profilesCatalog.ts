/**
 * Profiles available per peuple, grouped by family.
 * Each profile carries the voie IDs and martial formation IDs to auto-apply.
 * Source: Terres d'Arran rulebook tables.
 *
 * Voie IDs map (from rulebook label → data/voies.ts id):
 *   acrobatie              → voie-de-lacrobatie
 *   alchimie               → voie-de-lalchimie
 *   archerie               → voie-de-larcherie
 *   arbalètrie             → voie-de-larbeletrie
 *   arts druidiques        → voie-des-arts-druidiques
 *   assassinat             → voie-de-lassassinat
 *   bastion                → voie-du-bastion
 *   bohème                 → voie-du-boheme
 *   bravoure               → voie-de-la-bravoure
 *   charme                 → voie-du-charme
 *   chasse                 → voie-de-la-chasse
 *   combat à deux armes    → voie-du-combat-a-deux-armes
 *   combat monté           → voie-du-combat-monte
 *   commandement           → voie-du-commandement
 *   compagnon animal       → voie-du-compagnon-animal
 *   divination             → voie-de-la-divination
 *   envoûtement            → voie-de-lenvoutement
 *   escrime                → voie-de-lescrime
 *   férocité               → voie-de-la-ferocite
 *   forêts                 → voie-des-forets
 *   fourberie              → voie-de-la-fourberie
 *   guerre                 → voie-de-la-guerre
 *   illusions              → voie-des-illusions
 *   magie élémentaliste    → voie-de-la-magie-elementaliste
 *   magie runique          → voie-de-la-magie-runique
 *   maîtrise des armes     → voie-de-la-maitrise-des-armes
 *   mysticisme             → voie-du-mysticisme
 *   pugilat                → voie-du-pugilat
 *   puissance              → voie-de-la-puissance
 *   sombres savoirs        → voie-des-sombres-savoirs
 *
 * Martial formation IDs (data/martialWeaponCategories.ts):
 *   guerre | guerre_lourdes | hast | duel | trait | tir | jet
 *   (paysan is always active — never stored)
 *   Note: "armures légères / lourdes" are armor proficiencies — not yet modelled as formations.
 */

import type { MartialWeaponCategoryId } from './martialWeaponCategories'

export interface ProfileEntry {
  id: string
  name: string
  family: 'combattants' | 'aventuriers' | 'mystiques'
  /** Voie IDs from data/voies.ts to auto-add (at rank 0) when this profile is selected. */
  voieIds: string[]
  /** Martial formation IDs to auto-check when this profile is selected. */
  martialFormations: MartialWeaponCategoryId[]
}

// ── ELFES ──────────────────────────────────────────────────────────────────────

const ELFE_PROFILES: ProfileEntry[] = [
  // Elfe Bleu
  {
    id: 'elfe-protecteur', name: 'Protecteur/Protectrice', family: 'combattants',
    voieIds: ['voie-de-lacrobatie', 'voie-du-combat-a-deux-armes', 'voie-de-la-guerre'],
    martialFormations: ['guerre', 'trait'],
  },
  {
    id: 'elfe-marin', name: 'Marin', family: 'aventuriers',
    voieIds: ['voie-de-lacrobatie', 'voie-de-larcherie', 'voie-du-pugilat'],
    martialFormations: ['trait'],
  },
  {
    id: 'elfe-prophete', name: 'Prophète/Prophétesse', family: 'mystiques',
    voieIds: ['voie-de-la-divination', 'voie-de-lenvoutement', 'voie-du-mysticisme'],
    martialFormations: [],
  },
  // Elfe Sylvain
  {
    id: 'elfe-rodeur', name: 'Rôdeur/Rôdeuse', family: 'combattants',
    voieIds: ['voie-de-la-chasse', 'voie-du-combat-a-deux-armes', 'voie-de-la-maitrise-des-armes'],
    martialFormations: ['guerre', 'trait'],
  },
  {
    id: 'elfe-forestier', name: 'Forestier/Forestière', family: 'aventuriers',
    voieIds: ['voie-de-larcherie', 'voie-des-arts-druidiques', 'voie-du-compagnon-animal'],
    martialFormations: ['trait'],
  },
  {
    id: 'elfe-druide', name: 'Druide/Druidesse', family: 'mystiques',
    voieIds: ['voie-des-arts-druidiques', 'voie-du-compagnon-animal', 'voie-des-forets'],
    martialFormations: ['trait'],
  },
  // Elfe Blanc
  {
    id: 'elfe-noble', name: 'Noble', family: 'combattants',
    voieIds: ['voie-du-combat-monte', 'voie-du-commandement', 'voie-de-la-guerre'],
    martialFormations: ['guerre', 'hast'],
  },
  {
    id: 'elfe-pisteur', name: 'Pisteur/Pisteuse', family: 'aventuriers',
    voieIds: ['voie-du-boheme', 'voie-de-la-chasse', 'voie-de-la-maitrise-des-armes'],
    martialFormations: ['guerre'],
  },
  {
    id: 'elfe-elementaliste', name: 'Élémentaliste', family: 'mystiques',
    voieIds: ['voie-de-lescrime', 'voie-de-la-magie-elementaliste', 'voie-de-la-magie-runique'],
    martialFormations: ['duel'],
  },
  // Elfe Noir
  {
    id: 'elfe-executeur', name: 'Exécuteur/Exécutrice', family: 'combattants',
    voieIds: ['voie-du-combat-a-deux-armes', 'voie-de-la-guerre', 'voie-de-la-maitrise-des-armes'],
    martialFormations: ['guerre', 'duel'],
  },
  {
    id: 'elfe-assassin', name: 'Assassin/Assassine', family: 'aventuriers',
    voieIds: ['voie-de-lassassinat', 'voie-de-lescrime', 'voie-de-la-fourberie'],
    martialFormations: ['duel'],
  },
  {
    id: 'elfe-ombre-lame', name: 'Ombre-lame', family: 'mystiques',
    voieIds: ['voie-de-lassassinat', 'voie-de-lenvoutement', 'voie-des-sombres-savoirs'],
    martialFormations: ['duel'],
  },
  // Semi-Elfe
  {
    id: 'elfe-mercenaire', name: 'Mercenaire', family: 'combattants',
    voieIds: ['voie-de-larcherie', 'voie-du-combat-a-deux-armes', 'voie-de-la-maitrise-des-armes'],
    martialFormations: ['guerre', 'trait'],
  },
  {
    id: 'elfe-voyageur', name: 'Voyageur/Voyageuse', family: 'aventuriers',
    voieIds: ['voie-de-larcherie', 'voie-du-boheme', 'voie-de-lescrime'],
    martialFormations: ['trait', 'duel'],
  },
  {
    id: 'elfe-conseiller', name: 'Conseiller/Conseillère', family: 'mystiques',
    voieIds: ['voie-du-boheme', 'voie-de-la-divination', 'voie-de-lenvoutement'],
    martialFormations: ['jet'],
  },
]

// ── NAINS ──────────────────────────────────────────────────────────────────────

const NAIN_PROFILES: ProfileEntry[] = [
  // Forge
  {
    id: 'nain-forgeron', name: 'Forgeron/Forgeronne', family: 'combattants',
    voieIds: ['voie-de-la-guerre', 'voie-de-la-magie-runique', 'voie-de-la-puissance'],
    martialFormations: ['guerre', 'guerre_lourdes'],
  },
  {
    id: 'nain-apothicaire', name: 'Apothicaire', family: 'aventuriers',
    voieIds: ['voie-de-lalchimie', 'voie-de-larbeletrie', 'voie-de-la-bravoure'],
    martialFormations: ['tir'],
  },
  {
    id: 'nain-alchimiste', name: 'Alchimiste', family: 'mystiques',
    voieIds: ['voie-de-lalchimie', 'voie-de-la-magie-runique', 'voie-des-sombres-savoirs'],
    martialFormations: [],
  },
  // Talion
  {
    id: 'nain-garde-corps', name: 'Garde du corps', family: 'combattants',
    voieIds: ['voie-du-bastion', 'voie-de-la-maitrise-des-armes', 'voie-de-la-puissance'],
    martialFormations: ['guerre', 'tir'],
  },
  {
    id: 'nain-marchand', name: 'Marchand/Marchande', family: 'aventuriers',
    voieIds: ['voie-du-boheme', 'voie-du-charme', 'voie-de-la-fourberie'],
    martialFormations: ['tir'],
  },
  {
    id: 'nain-espion', name: 'Espion/Espionne', family: 'mystiques',
    voieIds: ['voie-de-lalchimie', 'voie-de-la-fourberie', 'voie-des-illusions'],
    martialFormations: [],
  },
  // Temple
  {
    id: 'nain-garde-sceaux', name: 'Garde/Gardienne des sceaux', family: 'combattants',
    voieIds: ['voie-de-larbeletrie', 'voie-du-combat-a-deux-armes', 'voie-de-la-guerre'],
    martialFormations: ['guerre', 'tir'],
  },
  {
    id: 'nain-ingenieur', name: 'Ingénieur/Ingénieure', family: 'aventuriers',
    voieIds: ['voie-de-larbeletrie', 'voie-de-la-magie-runique', 'voie-de-la-maitrise-des-armes'],
    martialFormations: ['tir'],
  },
  {
    id: 'nain-pretre', name: 'Prêtre/Prêtresse', family: 'mystiques',
    voieIds: ['voie-du-commandement', 'voie-de-la-divination', 'voie-du-mysticisme'],
    martialFormations: ['tir'],
  },
  // Bouclier
  {
    id: 'nain-porte-bouclier', name: 'Porte-bouclier', family: 'combattants',
    voieIds: ['voie-du-bastion', 'voie-de-la-bravoure', 'voie-du-commandement'],
    martialFormations: ['guerre', 'guerre_lourdes'],
  },
  {
    id: 'nain-eclaireur', name: 'Éclaireur/Éclaireuse', family: 'aventuriers',
    voieIds: ['voie-de-larcherie', 'voie-de-la-chasse', 'voie-du-combat-monte'],
    martialFormations: ['trait'],
  },
  {
    id: 'nain-aumonier', name: 'Aumônier/Aumônière', family: 'mystiques',
    voieIds: ['voie-du-commandement', 'voie-de-la-magie-elementaliste', 'voie-des-sombres-savoirs'],
    martialFormations: ['guerre_lourdes'],
  },
  // Errants
  {
    id: 'nain-monteur', name: 'Monteur/Monteuse de cochon', family: 'combattants',
    voieIds: ['voie-du-combat-monte', 'voie-de-la-bravoure', 'voie-de-la-guerre'],
    martialFormations: ['hast', 'jet'],
  },
  {
    id: 'nain-trappeur', name: 'Trappeur/Trappeuse', family: 'aventuriers',
    voieIds: ['voie-de-la-chasse', 'voie-du-compagnon-animal', 'voie-de-la-fourberie'],
    martialFormations: ['guerre'],
  },
  {
    id: 'nain-pelerin', name: 'Pèlerin/Pèlerine', family: 'mystiques',
    voieIds: ['voie-du-combat-monte', 'voie-des-illusions', 'voie-du-mysticisme'],
    martialFormations: ['tir'],
  },
]

// ── HUMAINS ────────────────────────────────────────────────────────────────────

const HUMAIN_PROFILES: ProfileEntry[] = [
  // Ruines nordiques
  {
    id: 'humain-barbare', name: 'Barbare', family: 'combattants',
    voieIds: ['voie-de-la-bravoure', 'voie-de-la-ferocite', 'voie-de-la-puissance'],
    martialFormations: ['guerre', 'guerre_lourdes'],
  },
  {
    id: 'humain-pirate', name: 'Pirate', family: 'aventuriers',
    voieIds: ['voie-de-lacrobatie', 'voie-de-larbeletrie', 'voie-de-la-ferocite'],
    martialFormations: ['tir', 'guerre'],
  },
  {
    id: 'humain-ermite', name: 'Ermite', family: 'mystiques',
    voieIds: ['voie-de-la-divination', 'voie-des-illusions', 'voie-du-pugilat'],
    martialFormations: [],
  },
  // Mitan
  {
    id: 'humain-milicien', name: 'Milicien/Milicienne', family: 'combattants',
    voieIds: ['voie-de-larbeletrie', 'voie-du-commandement', 'voie-de-la-maitrise-des-armes'],
    martialFormations: ['guerre', 'tir'],
  },
  {
    id: 'humain-courtisan', name: 'Courtisan/Courtisane', family: 'aventuriers',
    voieIds: ['voie-du-boheme', 'voie-du-charme', 'voie-de-lescrime'],
    martialFormations: ['duel'],
  },
  {
    id: 'humain-fauconnier', name: 'Fauconnier/Fauconnière', family: 'mystiques',
    voieIds: ['voie-de-larcherie', 'voie-des-arts-druidiques', 'voie-du-mysticisme'],
    martialFormations: ['trait'],
  },
  // Empires austraux
  {
    id: 'humain-soldat', name: 'Soldat/Soldate', family: 'combattants',
    voieIds: ['voie-du-bastion', 'voie-de-la-guerre', 'voie-de-la-maitrise-des-armes'],
    martialFormations: ['guerre', 'guerre_lourdes'],
  },
  {
    id: 'humain-explorateur', name: 'Explorateur/Exploratrice', family: 'aventuriers',
    voieIds: ['voie-du-boheme', 'voie-du-compagnon-animal', 'voie-de-la-fourberie'],
    martialFormations: ['guerre'],
  },
  {
    id: 'humain-mage', name: 'Mage', family: 'mystiques',
    voieIds: ['voie-de-lenvoutement', 'voie-des-illusions', 'voie-de-la-magie-elementaliste'],
    martialFormations: [],
  },
  // Terres orientales
  {
    id: 'humain-castagneur', name: 'Castagneur/Castagneuse', family: 'combattants',
    voieIds: ['voie-de-la-bravoure', 'voie-de-la-fourberie', 'voie-du-pugilat'],
    martialFormations: ['jet', 'tir'],
  },
  {
    id: 'humain-escroc', name: 'Escroc', family: 'aventuriers',
    voieIds: ['voie-de-lassassinat', 'voie-de-lescrime', 'voie-du-charme'],
    martialFormations: ['duel'],
  },
  {
    id: 'humain-ensorceleur', name: 'Ensorceleur/Ensorceleuse', family: 'mystiques',
    voieIds: ['voie-de-lenvoutement', 'voie-du-charme', 'voie-des-illusions'],
    martialFormations: [],
  },
]

// ── PEAUX VERTES ───────────────────────────────────────────────────────────────

const PEAU_VERTE_PROFILES: ProfileEntry[] = [
  // Orc
  {
    id: 'pv-guerrier', name: 'Guerrier/Guerrière tribal(e)', family: 'combattants',
    voieIds: ['voie-du-bastion', 'voie-de-la-ferocite', 'voie-de-la-guerre'],
    martialFormations: ['guerre', 'guerre_lourdes'],
  },
  {
    id: 'pv-chasseur', name: 'Chasseur/Chasseuse', family: 'aventuriers',
    voieIds: ['voie-de-larcherie', 'voie-de-la-chasse', 'voie-de-la-guerre'],
    martialFormations: ['trait'],
  },
  {
    id: 'pv-necromancien', name: 'Nécromancien/Nécromancienne', family: 'mystiques',
    voieIds: ['voie-de-la-bravoure', 'voie-de-la-divination', 'voie-des-sombres-savoirs'],
    martialFormations: [],
  },
  // Gobelin
  {
    id: 'pv-archer', name: 'Archer/Archère', family: 'combattants',
    voieIds: ['voie-de-larcherie', 'voie-de-la-bravoure', 'voie-de-la-maitrise-des-armes'],
    martialFormations: ['guerre', 'trait'],
  },
  {
    id: 'pv-voleur', name: 'Voleur/Voleuse', family: 'aventuriers',
    voieIds: ['voie-de-lacrobatie', 'voie-de-lescrime', 'voie-de-la-fourberie'],
    martialFormations: ['duel'],
  },
  {
    id: 'pv-chaman', name: 'Chaman/Chamane', family: 'mystiques',
    voieIds: ['voie-de-lalchimie', 'voie-des-forets', 'voie-du-pugilat'],
    martialFormations: [],
  },
  // Ogre
  {
    id: 'pv-sanguinaire', name: 'Sanguinaire', family: 'combattants',
    voieIds: ['voie-de-la-ferocite', 'voie-de-la-guerre', 'voie-de-la-puissance'],
    martialFormations: ['guerre_lourdes', 'jet'],
  },
  {
    id: 'pv-porte-etendard', name: 'Porte-étendard', family: 'aventuriers',
    voieIds: ['voie-des-arts-druidiques', 'voie-de-la-chasse', 'voie-du-commandement'],
    martialFormations: ['guerre'],
  },
  {
    id: 'pv-ancien', name: 'Ancien/Ancienne', family: 'mystiques',
    voieIds: ['voie-des-forets', 'voie-de-la-magie-elementaliste', 'voie-des-sombres-savoirs'],
    martialFormations: [],
  },
]

// ── Index ──────────────────────────────────────────────────────────────────────

const ALL_PROFILES: ProfileEntry[] = [
  ...ELFE_PROFILES,
  ...NAIN_PROFILES,
  ...HUMAIN_PROFILES,
  ...PEAU_VERTE_PROFILES,
]

export const PROFILES_BY_ID: Record<string, ProfileEntry> = Object.fromEntries(
  ALL_PROFILES.map((p) => [p.id, p]),
)

const PROFILES_BY_PEUPLE: Record<string, ProfileEntry[]> = {
  'elfe': ELFE_PROFILES,
  'semi-elfe': ELFE_PROFILES,
  'sang-mele': [
    ...ELFE_PROFILES, ...NAIN_PROFILES, ...HUMAIN_PROFILES, ...PEAU_VERTE_PROFILES,
  ],
  'nain': NAIN_PROFILES,
  'humain': HUMAIN_PROFILES,
  'peau-verte': PEAU_VERTE_PROFILES,
}

export function getProfilesForPeuple(peupleId: string): ProfileEntry[] {
  return PROFILES_BY_PEUPLE[peupleId] ?? []
}

/** Find a profile entry by its display name (used when matching a free-text value). */
export function findProfileByName(name: string): ProfileEntry | undefined {
  return ALL_PROFILES.find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  )
}

export const FAMILY_LABELS: Record<ProfileEntry['family'], string> = {
  combattants: 'Combattants',
  aventuriers: 'Aventuriers',
  mystiques: 'Mystiques',
}
