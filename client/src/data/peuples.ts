import type { Capacite } from './voies'

export interface PeupleVoie {
  id: string
  name: string
  capacites: [Capacite, Capacite, Capacite, Capacite, Capacite]
}

export interface Peuple {
  id: string
  name: string
  /** Habituellement 1 voie, mais 2 pour Semi-Elfe / Sang-mêlé (max rang 3 chacune). */
  voiesDePeuple: PeupleVoie[]
  voiesCulturelles: PeupleVoie[]
}

// ── ELFES ─────────────────────────────────────────────────────────────────────

const voiePeupleElfe: PeupleVoie = {
  id: 'peuple-elfe',
  name: 'Voie du peuple elfe',
  capacites: [
    { name: 'Grâce elfique', description: '+5 à tous les tests de CHA et aux tests de déplacement silencieux.', active: false },
    { name: 'Essence magique', description: '+2 en DEF contre les attaques magiques et aux tests pour résister à la magie ; +4 à partir du rang 4 de cette voie.', active: false },
    { name: 'Maîtrise des armes elfiques', description: 'Peut porter et utiliser les armes et armures de la tradition elfique pour lesquelles il possède la formation martiale.', active: false },
    { name: 'Empathie elfique', description: 'Retrouve intuitivement les êtres chers ; ressent leur santé physique et psychologique ; perçoit un danger les menaçant.', active: false },
    { name: 'Immortalité', description: '+2 CON ; les blessures guérissent plus vite ; en dépensant 1 PR, regagne [2 × DV + niveau + Mod. CON] PV.', active: true },
  ],
}

const voiePeupleHumain: PeupleVoie = {
  id: 'peuple-humain',
  name: 'Voie du peuple humain',
  capacites: [
    { name: 'Adaptable', description: 'Après un échec à un test de Carac., +5 au prochain test pour retenter la même action au tour suivant.', active: false },
    { name: 'Loup parmi les loups', description: '+1 DM contre les humanoïdes (+2 à partir du rang 4 de cette voie).', active: false },
    { name: 'Enseignement exotique', description: 'Choisir une formation martiale et une tradition d\'un peuple des Terres d\'Arran ; ne peut porter/utiliser que les armes et armures maîtrisées et forgées dans cette tradition.', active: false },
    { name: 'Versatile', description: 'Choisir une capacité de rang 1 ou 2 de n\'importe quelle voie de profil.', active: false },
    { name: 'Dépassement', description: 'Augmenter une Carac. au choix de +2.', active: false },
  ],
}

// ── NAINS ─────────────────────────────────────────────────────────────────────

const voiePeupleNain: PeupleVoie = {
  id: 'peuple-nain',
  name: 'Voie du peuple nain',
  capacites: [
    { name: 'Résistance', description: '+5 à tous les tests de CON.', active: false },
    { name: 'Solide comme un roc', description: 'Réduit tous les DM subis de 1 (minimum 1 DM par attaque reçue). Cumulable avec d\'autres réductions.', active: false },
    { name: 'Maîtrise des armes runiques', description: 'Peut porter et utiliser les armes et armures de la tradition naine pour lesquelles il a la formation martiale.', active: false },
    { name: 'Résistance à la magie', description: 'Cible d\'un sort (sauf zone) : lance 1d4 — si le résultat est supérieur au rang du sort, ignorer les effets du sort.', active: true },
    { name: 'Ténacité naine', description: 'Une fois par jour, quand le PJ tombe à 0 PV : peut dépenser 1 PR et en appliquer les effets immédiatement ; +2 SAG.', active: true },
  ],
}

// ── PEAUX VERTES ──────────────────────────────────────────────────────────────

const voiePeuplePeauxVertes: PeupleVoie = {
  id: 'peuple-peaux-vertes',
  name: 'Voie du peuple peau verte',
  capacites: [
    { name: 'Pour l\'honneur', description: '+5 aux tests de Carac. pour toute interaction sociale avec d\'autres Peaux vertes.', active: false },
    { name: 'Frappe déloyale', description: 'Une fois par adversaire, après une attaque de contact ratée : annonce une feinte → test opposé (p.110) → aveugler, désarmer ou repousser.', active: true },
    { name: 'Maîtrise des armes sauvages', description: 'Armes et armures traditionnelles du peuple si formation martiale. Pour une Aberration, la tradition suit la voie culturelle choisie.', active: false },
    { name: 'Croyances païennes', description: 'Tatouage tribal au choix : taureau (+5 FOR), ours (+5 CON), panthère (+5 DEX), chouette (+5 SAG).', active: false },
    { name: 'Héros tribal', description: 'Dépenser 1 PC pour annuler un coup critique subi (devient coup normal) ; 1 fois/jour, 2 PC pour transformer une réussite adverse en échec (pas de réussite critique).', active: true },
  ],
}

// ── VOIES CULTURELLES ─────────────────────────────────────────────────────────

// — Elfes —

const cultureElfeBleu: PeupleVoie = {
  id: 'culture-elfe-bleu',
  name: 'Culture elfique — Elfe bleu',
  capacites: [
    { name: 'Équilibre parfait', description: 'Se relever est une action gratuite ; +5 aux tests d\'équilibre.', active: false },
    { name: 'Natif d\'Elsémur', description: 'Choisir une caste : religieuse (capacité de rang 1 ou 2 de la divination ou du mysticisme) ou guerrière (capacité de rang 1 ou 2 de la guerre ou du combat à deux armes). Au rang 4 de cette voie culturelle, capacité supplémentaire de rang 1 ou 2 dans la même caste.', active: false },
    { name: 'Imperturbable', description: '+5 aux tests pour résister aux effets mentaux (peur, intimidation, envoûtements) ; +3 à l\'Initiative.', active: false },
    { name: 'Les enseignements de l\'eau', description: 'Peut retenir sa respiration sous l\'eau 15 minutes ; au plus profond des océans, pas besoin de lumière pour se guider ; supporte les températures glaciales et la pression sans problème.', active: false },
    { name: 'Parangon elfe bleu', description: '+2 CON et +2 SAG.', active: false },
  ],
}

const cultureElfeSylvain: PeupleVoie = {
  id: 'culture-elfe-sylvain',
  name: 'Culture elfique — Elfe sylvain',
  capacites: [
    { name: 'Le chant de la Terre', description: '+5 aux tests de DEX et SAG lorsqu\'il est en forêt.', active: false },
    { name: 'Enfant de la forêt', description: 'Choisir une caste : religieuse (capacité de rang 1 ou 2 des arts druidiques ou des forêts) ou guerrière (capacité de rang 1 ou 2 de l\'archerie ou du compagnon animal). Au rang 4 de cette voie culturelle, capacité supplémentaire de rang 1 ou 2 dans la même caste.', active: false },
    { name: 'Archer émérite', description: 'Avec un arc, réussite critique sur 19–20 au d20 ; gagne la maîtrise des armes de trait.', active: false },
    { name: 'Compagnon animal supérieur', description: 'Gagne le rang 3 de la voie du Compagnon animal (p. 170). Si déjà possédée, le compagnon gagne +2 en initiative, DEF, attaque et DM.', active: false },
    { name: 'Parangon elfe vert', description: '+2 DEX et +2 SAG.', active: false },
  ],
}

const cultureElfeBlanc: PeupleVoie = {
  id: 'culture-elfe-blanc',
  name: 'Culture elfique — Elfe blanc',
  capacites: [
    { name: 'Mémoire du monde', description: '+5 aux tests d\'INT relatifs aux connaissances et à l\'érudition.', active: false },
    { name: 'Prédispositions magiques', description: 'Capacité de rang 1 ou 2 de la voie de l\'envoûtement ou de la voie de la magie élémentaliste. Au rang 4 de cette voie, capacité supplémentaire de rang 1 ou 2 dans l\'une de ces deux voies.', active: false },
    { name: 'Lancier d\'élite', description: 'Ignore les malus liés aux armes d\'hast ; gagne la maîtrise des armes d\'hast ; +1 aux tests d\'attaque et aux DM avec une arme d\'hast.', active: false },
    { name: 'Blancheur immaculée', description: 'N\'a besoin que de la moitié du repos, de la nourriture et de la boisson d\'un Elfe normal ; immunisé aux effets des poisons et des maladies.', active: false },
    { name: 'Parangon elfe blanc', description: '+2 INT et +2 SAG.', active: false },
  ],
}

const cultureElfeNoir: PeupleVoie = {
  id: 'culture-elfe-noir',
  name: 'Culture elfique — Elfe noir',
  capacites: [
    { name: 'Artiste de l\'ombre', description: 'Couverture d\'artiste (danse, théâtre, peinture, poésie) : +5 aux tests de CHA en rapport avec le domaine choisi, et aux tests pour trouver ou obtenir des informations secrètes ou sensibles.', active: false },
    { name: 'Apprenti de Slurce', description: 'Capacité de rang 1 ou 2 de la voie de l\'assassinat ou de la voie des sombres savoirs. Au rang 4 de cette voie culturelle, capacité supplémentaire de rang 1 ou 2 dans l\'une de ces deux voies.', active: false },
    { name: 'Armes secrètes', description: 'Peut dissimuler jusqu\'à deux armes légères (d6 max) ; test de DEX opposé à SAG de l\'adversaire : en cas de réussite, la première attaque de chaque arme surprend l\'adversaire et inflige les DM maximaux (y compris les dés bonus).', active: true },
    { name: 'Noir comme le sang', description: 'Une fois par combat, lorsqu\'il tombe à 0 PV, peut continuer à agir normalement ; une nouvelle attaque réussie infligeant au moins 1 DM l\'achève. Tant qu\'il est à 0 PV : +2 à tous ses tests.', active: true },
    { name: 'Parangon elfe noir', description: '+2 DEX et +2 CHA.', active: false },
  ],
}

// — Nains —

const cultureNainForge: PeupleVoie = {
  id: 'culture-nain-forge',
  name: 'Ordre de la Forge',
  capacites: [
    { name: 'Artisan de la forge', description: 'Choisir un métier de l\'ordre (alchimiste, armurier, médecin, orfèvre, mineur…) ; +5 à tous les tests liés à ce métier.', active: false },
    { name: 'Forgeron runique', description: 'Choisir une capacité de rang 1 ou 2 de la voie d\'alchimie ou de la magie runique ; au rang 4, une capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Marteler le métal', description: '+1 en attaque et aux DM avec un bâton ferré, une masse d\'armes ou un marteau à deux mains.', active: false },
    { name: 'Runes de défense', description: 'Runes sur l\'équipement (et parfois la peau) ; +2 DEF.', active: false },
    { name: 'Maître artisan', description: '+2 DEX et +2 INT.', active: false },
  ],
}

const cultureNainTalion: PeupleVoie = {
  id: 'culture-nain-talion',
  name: 'Ordre du Talion',
  capacites: [
    { name: 'Plein aux as', description: '25 pa par jour par rang dans cette voie pour les dépenses courantes ; l\'argent non dépensé ne s\'ajoute pas à la fortune.', active: false },
    { name: 'Le sens des affaires', description: 'Capacité de rang 1 ou 2 de la voie du bohème ou de la fourberie ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Pot-de-vin', description: 'Après un échec à un test de CHA, payer 10 pa par +1 (jusqu\'à 100 pa) pour transformer l\'échec en réussite.', active: true },
    { name: 'La Loge noire', description: 'Un garde loyal : +3 DEF au PJ au contact ; 1 fois/tour, le garde peut faire échouer une attaque contre le PJ (test d\'attaque ≥ DEF attaquant). Remplacement : 500 pa ou passage de niveau.', active: true },
    { name: 'Seigneur du Talion', description: '+2 INT et +2 CHA.', active: false },
  ],
}

const cultureNainTemple: PeupleVoie = {
  id: 'culture-nain-temple',
  name: 'Ordre du Temple',
  capacites: [
    { name: 'Grosse tête', description: 'Peut faire un test d\'INT à la place d\'un test de FOR pour la force "intelligente" (levier, etc.) ; +5 aux tests de bricolage et de science.', active: false },
    { name: 'Enseigne du Temple', description: 'Capacité de rang 1 ou 2 de la maîtrise des armes ou du mysticisme ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Invention étrange', description: 'Arbalète à répétition (offerte ou inventée) ; maîtrise des armes de tir.', active: false },
    { name: 'Rites funéraires (L)', description: 'Rituel (5 min) : communiquer avec les morts (réponses confuses) ; 1 fois/zone, action limitée + INT DD 15 → 2d6 DM aux esprits hostiles.', active: true },
    { name: 'Maître du temple', description: '+2 CON et +2 INT.', active: false },
  ],
}

const cultureNainBouclier: PeupleVoie = {
  id: 'culture-nain-bouclier',
  name: 'Ordre du Bouclier',
  capacites: [
    { name: 'Combat en phalange', description: 'Si le PJ combat la même créature qu\'un allié : +1 attaque et +1 DEF par allié au contact avec lui et la créature.', active: false },
    { name: 'Formation militaire', description: 'Capacité de rang 1 ou 2 du bastion ou du commandement ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Capitaine du Bouclier', description: 'Avec un bouclier : +1 DEF supplémentaire ; 1 fois/tour, peut ignorer une attaque à distance non critique en la déviant.', active: true },
    { name: 'Fuite interdite', description: 'Si un adversaire au contact s\'éloigne avec une action de mouvement : attaque de contact gratuite ; si elle touche, déplacement annulé (0 DM).', active: true },
    { name: 'Veilleur du roi', description: '+2 FOR et +2 CHA.', active: false },
  ],
}

const cultureNainErrants: PeupleVoie = {
  id: 'culture-nain-errants',
  name: 'Ordre des Errants',
  capacites: [
    { name: 'Moins que rien', description: '−5 aux tests sociaux avec la "bonne société" ; +5 avec les miséreux ; +5 en discrétion ; on l\'oublie facilement.', active: false },
    { name: 'Passé révolu', description: 'Capacité de rang 1 (puis rang 2 au rang 4) parmi : alchimie, magie runique, bohème, fourberie, maîtrise des armes, mysticisme, bastion, commandement.', active: false },
    { name: 'Paysan aguerri', description: '+1 attaque et DM avec une arme de paysan ; formation à la grande hache de bûcheron.', active: false },
    { name: 'Solidarité des Errants', description: 'Quand un miséreux peut aider : lance 1d6 — sur 1–4, aide totale ; sur 6 (MJ lance en secret), trahison pour profit.', active: true },
    { name: 'Volonté héroïque', description: '+2 CON et +2 SAG.', active: false },
  ],
}

const cultureNainMalt: PeupleVoie = {
  id: 'culture-nain-malt',
  name: 'Ordre du Malt',
  capacites: [
    { name: 'Art du brassage', description: '+5 à tous les tests d\'artisanat et de connaissances liés au brassage et à l\'alcool ; +5 aux tests de CON pour résister aux effets de l\'alcool.', active: false },
    { name: 'Sens de l\'effort', description: 'Choisir une capacité de rang 1 ou 2 de la voie de la puissance ou de la voie du charme ; au rang 4, capacité supplémentaire de rang 1 ou 2 dans l\'une de ces voies.', active: false },
    { name: 'Tiser entre amis', description: '+5 à tous les tests de CHA avec toute personne qui accepte de partager une boisson alcoolisée avec lui.', active: false },
    { name: 'Courage liquide', description: 'Après absorption d\'une quantité importante d\'alcool : gagne (Rang)d6 PV temporaires (perdus en premier) pendant une heure, insensibilité à toute forme de peur, et jusqu\'à 3 fois +5 à un test de FOR, CON ou CHA. 1 fois par jour.', active: true },
    { name: 'Seigneur du Malt', description: '+2 CHA et +2 CON.', active: false },
  ],
}

// — Humains —

const cultureHumainNordique: PeupleVoie = {
  id: 'culture-humain-nordique',
  name: 'Ruines nordiques',
  capacites: [
    { name: 'Pied marin', description: '+5 aux tests de navigation, natation et équilibre.', active: false },
    { name: 'Barbare', description: 'Capacité de rang 1 ou 2 de la bravoure ou de la chasse ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Expertise des haches', description: '+1 attaque et DM avec une hache ; formation à la grande hache de bûcheron.', active: false },
    { name: 'Homme des clans', description: 'Bras droit (allié de combat) : armes du PJ entretenues → critiques sur 19–20 ; remplacer au niveau suivant si mort. (DEF 16, PV = niv×6, etc.)', active: false },
    { name: 'Conquérant', description: '+2 DEX et +2 CON.', active: false },
  ],
}

const cultureHumainMitan: PeupleVoie = {
  id: 'culture-humain-mitan',
  name: 'Mitan',
  capacites: [
    { name: 'Homme des cités', description: '+5 aux tests de perception en foule et pour trouver personne / lieu en zone urbaine.', active: false },
    { name: 'Entre tradition et progrès', description: 'Capacité de rang 1 ou 2 du combat monté ou de l\'arbalétrie ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Modernisme', description: '+1 attaque et DM avec une arbalète ; maîtrise des armes de tir.', active: false },
    { name: 'Conspirateur', description: '1 fois par aventure, contact pour service / info / alliance : test de CHA DD 10/15/20 selon difficulté ; échec possible avec contrepartie pécuniaire.', active: true },
    { name: 'Maître marchand', description: '+2 INT et +2 CHA.', active: false },
  ],
}

const cultureHumainAustral: PeupleVoie = {
  id: 'culture-humain-austral',
  name: 'Empires austraux',
  capacites: [
    { name: 'Érudition', description: 'Sait lire et écrire ; +5 dans un domaine au choix parmi : histoire & géographie ; occultisme & magie ; sciences & techniques ; plantes & créatures ; langues anciennes.', active: false },
    { name: 'Études arcaniques', description: 'Capacité de rang 1 ou 2 de la magie élémentaliste ou des illusions ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Autorité culturelle', description: '+2 Initiative et +2 DEF ; ou (au choix) un second domaine d\'érudition comme au rang 1.', active: false },
    { name: 'Prédispositions arcaniques', description: 'Ajouter le Mod. de CHA au total de PM (non doublé pour les mystiques).', active: false },
    { name: 'Mage', description: '+2 INT et +2 SAG.', active: false },
  ],
}

const cultureHumainOriental: PeupleVoie = {
  id: 'culture-humain-oriental',
  name: 'Terres orientales',
  capacites: [
    { name: 'Connaissances cosmopolites', description: '+5 pour négocier, argumenter, mentir ou convaincre un non-humain.', active: false },
    { name: 'Rejeton de la cité des Sang-mêlés', description: 'Capacité de rang 1 ou 2 du charme ou de la fourberie ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Sentir la magie', description: 'Test de SAG DD 15 : savoir si un interlocuteur maîtrise au moins une voie mystique ; +5 pour résister aux effets magiques.', active: true },
    { name: 'Chevaucheur de dragons', description: 'Monture dragon d\'Akrähyng (Init 15, DEF 16, PV = 5×niveau, Att +8, DM 1d6+4 feu portée 20m). Synergies avec Monture fantastique et Ordre de chevalerie : +2 DEF, attaque et DM par capacité possédée.', active: false },
    { name: 'Expert en filouterie', description: '+2 DEX et +2 CHA.', active: false },
  ],
}

// — Peaux vertes —

const cultureOrc: PeupleVoie = {
  id: 'culture-orc',
  name: 'Culture orc',
  capacites: [
    { name: 'Force de la nature', description: '+5 aux tests de FOR ; ajouter le Mod. FOR au total de PV.', active: false },
    { name: 'Talent pour la violence', description: 'Capacité de rang 1 ou 2 de la férocité ou de la puissance ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Critique brutal', description: 'Sur critique en contact, DM ×3 au lieu de ×2.', active: false },
    { name: 'Attaque sanglante (L)', description: 'Hémorragie : +1d6 DM par tour jusqu\'à réussite d\'un test de CON DD [12 + Mod. FOR] ou soins ; pas de cumul de saignements.', active: true },
    { name: 'Colosse', description: '+2 FOR et +2 CON.', active: false },
  ],
}

const cultureGobelin: PeupleVoie = {
  id: 'culture-gobelin',
  name: 'Culture gobeline',
  capacites: [
    { name: 'Insignifiant', description: '1 fois par combat, si ciblé : rediriger l\'assaillant vers une autre cible (tant que le gobelin ne le réattaque pas) ; +5 pour se fondre dans la masse.', active: true },
    { name: 'Agile et sournois', description: 'Capacité de rang 1 ou 2 de l\'acrobatie ou de l\'assassinat ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Ombre mouvante (L)', description: 'Test DEX DD 10 : déplacement jusqu\'à 20m vers zone d\'ombre / couvert, disparaît jusqu\'au tour suivant. Si initiative gagnée sur une cible au contact : +2d6 DM.', active: true },
    { name: 'Rochassier', description: 'Escalade comme sur le plat à quatre membres ; avec trois membres : immobile ou demi-vitesse.', active: false },
    { name: 'Teigneux', description: '+2 DEX et +2 INT.', active: false },
  ],
}

const cultureOgre: PeupleVoie = {
  id: 'culture-ogre',
  name: 'Culture ogre',
  capacites: [
    { name: 'Énorme', description: 'Manier d\'une seule main les grandes armes à deux mains ; −2 aux tests d\'attaque (−5 avec arme magique ≥ exceptionnelle).', active: false },
    { name: 'Brute', description: 'Capacité de rang 1 ou 2 de la férocité ou du pugilat ; au rang 4, capacité supplémentaire de rang 1 ou 2.', active: false },
    { name: 'Attaque massive (L)', description: 'Attaque de tout le poids : bonus aux DM = Mod. CON, malus à la DEF = Mod. CON pendant un tour.', active: true },
    { name: 'Intuable', description: 'Au moment de tomber à 0 PV, peut refuser l\'inconscience et continuer à combattre ; PV peuvent devenir négatifs jusqu\'à la valeur de CON (au-delà : mort).', active: true },
    { name: 'Monstre', description: '+2 FOR et +2 CON.', active: false },
  ],
}

// ── LISTE DES PEUPLES ─────────────────────────────────────────────────────────

export const PEUPLES: Peuple[] = [
  {
    id: 'elfe',
    name: 'Elfe',
    voiesDePeuple: [voiePeupleElfe],
    voiesCulturelles: [cultureElfeBleu, cultureElfeSylvain, cultureElfeBlanc, cultureElfeNoir],
  },
  {
    id: 'semi-elfe',
    name: 'Semi-Elfe',
    voiesDePeuple: [voiePeupleElfe, voiePeupleHumain],
    voiesCulturelles: [
      cultureElfeBleu, cultureElfeSylvain, cultureElfeBlanc, cultureElfeNoir,
      cultureHumainNordique, cultureHumainMitan, cultureHumainAustral, cultureHumainOriental,
    ],
  },
  {
    id: 'sang-mele',
    name: 'Sang-mêlé',
    voiesDePeuple: [],
    voiesCulturelles: [
      cultureElfeBleu, cultureElfeSylvain, cultureElfeBlanc, cultureElfeNoir,
      cultureHumainNordique, cultureHumainMitan, cultureHumainAustral, cultureHumainOriental,
      cultureNainForge, cultureNainTalion, cultureNainTemple, cultureNainBouclier, cultureNainErrants, cultureNainMalt,
      cultureOrc, cultureGobelin, cultureOgre,
    ],
  },
  {
    id: 'nain',
    name: 'Nain',
    voiesDePeuple: [voiePeupleNain],
    voiesCulturelles: [
      cultureNainForge, cultureNainTalion, cultureNainTemple, cultureNainBouclier, cultureNainErrants, cultureNainMalt,
    ],
  },
  {
    id: 'humain',
    name: 'Humain',
    voiesDePeuple: [voiePeupleHumain],
    voiesCulturelles: [
      cultureHumainNordique, cultureHumainMitan, cultureHumainAustral, cultureHumainOriental,
    ],
  },
  {
    id: 'peau-verte',
    name: 'Peau verte',
    voiesDePeuple: [voiePeuplePeauxVertes],
    voiesCulturelles: [cultureOrc, cultureGobelin, cultureOgre],
  },
]

export const PEUPLES_BY_ID: Record<string, Peuple> = Object.fromEntries(PEUPLES.map(p => [p.id, p]))

/** Lookup combiné : toutes les voies de peuple + culturelles, indexées par id. */
export const PEUPLE_VOIES_BY_ID: Record<string, PeupleVoie> = (() => {
  const map: Record<string, PeupleVoie> = {}
  for (const p of PEUPLES) {
    for (const v of p.voiesDePeuple) map[v.id] = v
    for (const v of p.voiesCulturelles) map[v.id] = v
  }
  return map
})()
