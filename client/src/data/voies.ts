import type { CharacterAbilities } from '../types/character'

/** Les trois familles du livre. Une voie de prestige appartient aussi à l'une d'elles. */
export type VoieFamily = 'combattants' | 'aventuriers' | 'mystiques'

export type AbilityKey = keyof CharacterAbilities

/** Un bonus fixe, ou le Mod. d'une carac (Grâce féline : Mod. de CHA). */
export type StatBonus = number | { mod: AbilityKey }

/** Effets qu'un moteur sait appliquer tout seul. Le reste des passifs reste du texte. */
export type CapaciteEffect =
  /** +2 en INT — passif permanent */
  | { kind: 'ability'; ability: AbilityKey; bonus: number }
  /** 2d20 sur tous les tests de cette carac — passif permanent */
  | { kind: 'advantage'; on: AbilityKey }
  /** 2d20 sur le jet de cette action précise, quand on clique sa carte */
  | { kind: 'attackAdvantage' }
  /**
   * +X en DEF, en initiative ou aux PV max. `fromRank` : seulement à partir de
   * ce rang dans la voie (Robustesse : +3 PV aux rangs 1, 3 et 5).
   */
  | { kind: 'def' | 'init' | 'hp'; bonus: StatBonus; fromRank?: number }
  /** Réduction des DM subis (RD). */
  | { kind: 'rd'; bonus: number }
  /** +X à tous les tests de cette carac (Résistance naine : +5 CON). */
  | { kind: 'test'; on: AbilityKey; bonus: number }
  /** Critique dès ce résultat au d20 (19 = 19-20). `rapiere` : seuil avec une rapière. */
  | { kind: 'critRange'; min: number; rapiere?: number }
  /** Bonus avec l'arme cochée « de prédilection » sur la fiche. */
  | { kind: 'favoriteWeapon'; attack?: number; damage?: number }
  /** Mod. d'une carac ajouté aux DM avec un arc (Sens affûtés). */
  | { kind: 'bowDamage'; mod: AbilityKey }
  /** Une autre capacité de la voie devient une action d'attaque (Combat à deux armes parfait). */
  | { kind: 'fasterAction'; capacite: string }

export interface Capacite {
  name: string
  description: string
  active?: boolean
  /** Sort (*) : coûte des PM. */
  spell?: true
  /** Rang du sort quand il diffère du rang dans la voie (Forme élémentaire : toujours 4). */
  spellRank?: number
  effects?: CapaciteEffect[]
}

export interface Voie {
  id: string
  name: string
  family: VoieFamily
  /** Voie de prestige : niveau 8, 2 points par rang. */
  prestige?: true
  capacites: [Capacite, Capacite, Capacite, Capacite, Capacite]
}

export const VOIES: Voie[] = [
  // ── COMBATTANTS ──────────────────────────────────────────────────────────
  {
    id: 'voie-du-bastion',
    name: 'Voie du bastion',
    family: 'combattants',
    capacites: [
      { name: 'Protéger un allié', description: "Accorde le Mod. de DEF de son bouclier à un compagnon adjacent. Peut changer de compagnon à chaque tour.", active: true },
      { name: 'Absorber un coup', description: "Après une action, peut effectuer un test d'attaque au contact en opposition pour annuler un coup reçu avant son prochain tour.", active: true },
      { name: 'Coup de bouclier', description: "Attaque gratuite au bouclier chaque tour avec d12, infligeant [1d4 + Mod. FOR] DM.", active: true },
      { name: 'Absorber un sort', description: "Après une action, peut effectuer un test d'attaque magique en opposition pour annuler un sort avant son prochain tour.", active: true },
      { name: 'Armure lourde', description: "Peut porter une armure de plaques (+7 DEF). Celle-ci le protège des attaques critiques (DM normaux au lieu de doublés).", active: false },
    ],
  },
  {
    id: 'voie-de-la-bravoure',
    name: 'Voie de la bravoure',
    family: 'combattants',
    capacites: [
      { name: 'Robustesse', description: "+3 PV au rang 1, +3 PV au rang 3, +3 PV au rang 5.", active: false, effects: [{ kind: 'hp', bonus: 3 }, { kind: 'hp', bonus: 3, fromRank: 3 }, { kind: 'hp', bonus: 3, fromRank: 5 }] },
      { name: 'Armure naturelle', description: "Le corps est endurci : +2 en DEF.", active: false, effects: [{ kind: 'def', bonus: 2 }] },
      { name: 'Prouesse', description: "1 fois/tour, sacrifier 1d4 PV pour +5 à un test de FOR ou DEX.", active: true },
      { name: 'Dernier rempart', description: "Ne réalise qu'une attaque ce tour mais obtient une attaque gratuite contre tout ennemi qui s'approche. Un ennemi blessé voit son déplacement arrêté.", active: true },
      { name: 'Constitution héroïque', description: "+2 en CON. Lance 2d20 à tous les tests de CON et garde le meilleur.", active: false, effects: [{ kind: 'ability', ability: 'constitution', bonus: 2 }, { kind: 'advantage', on: 'constitution' }] },
    ],
  },
  {
    id: 'voie-du-combat-a-deux-armes',
    name: 'Voie du combat à deux armes',
    family: 'combattants',
    capacites: [
      { name: 'Combat à deux armes', description: "Action limitée. Attaque de chaque main : d20 pour la main directrice, d12 pour la main faible (arme légère max d6 DM). Désignez vos armes dans la liste ci-dessus.", active: true },
      { name: 'Parade croisée', description: "+2 DEF ce tour avec une seule attaque. Résultat pair = main principale, impair = main faible.", active: true },
      { name: 'Symétrie', description: "Plus obligé de manier une arme légère en main faible (jusqu'à d8). Deux armes légères accordent un bonus supplémentaire.", active: false },
      { name: 'Double peine', description: "Si les deux armes atteignent la cible le même tour, +1d6 DM sur l'une des deux attaques.", active: false },
      { name: 'Combat à deux armes parfait', description: "Le combat à deux armes ne nécessite plus qu'une action d'attaque au lieu d'une action limitée.", active: false, effects: [{ kind: 'fasterAction', capacite: 'Combat à deux armes' }] },
    ],
  },
  {
    id: 'voie-du-combat-monte',
    name: 'Voie du combat monté',
    family: 'combattants',
    capacites: [
      { name: 'Fidèle monture', description: "Possède un destrier puissant. En selle, peut ajouter un déplacement de 10m avant ou après une action.", active: false },
      { name: 'Cavalier émérite', description: "+2 en attaque au contact à cheval. Partage sa DEF avec la monture (garde le meilleur). Monter/descendre = action gratuite.", active: false },
      { name: 'Massacrer la piétaille', description: "+1d6 DM contre la piétaille (au moins 4 créatures similaires) lorsqu'il est en selle.", active: false },
      { name: 'Charge', description: "Déplacement de 40m en ligne droite et une attaque de contact. Doit parcourir au moins 10m avant d'attaquer.", active: true, effects: [{ kind: 'attackAdvantage' }] },
      { name: 'Monture fantastique', description: "Obtient une monture volante (aspic, dragon, griffon…). Peut faire attaquer sa monture en même temps que lui.", active: true },
    ],
  },
  {
    id: 'voie-du-commandement',
    name: 'Voie du commandement',
    family: 'combattants',
    capacites: [
      { name: 'Action concertée', description: "1 fois/tour, échange son initiative avec un PJ volontaire. Si le PJ cède son initiative, +1 en attaque.", active: true },
      { name: 'À couvert', description: "DM à distance et de zone divisés par 2, déplacement de 20m. Un allié adjacent peut en profiter.", active: true },
      { name: 'Exemplaire', description: "1 fois/tour, un allié combattant le même adversaire peut relancer un test d'attaque raté.", active: true },
      { name: 'Ordre de bataille', description: "1 fois/tour, octroie une action de mouvement ou d'attaque gratuite à un allié en vue.", active: true },
      { name: 'Charge fantastique', description: "1 fois/combat, le PJ et tous ses alliés en vue bougent de 20m en ligne droite et attaquent avec +3 et +1d6 DM.", active: true },
    ],
  },
  {
    id: 'voie-de-la-ferocite',
    name: 'Voie de la férocité',
    family: 'combattants',
    capacites: [
      { name: 'Cri de guerre', description: "1 fois/combat, les ennemis avec FOR ou PV max inférieurs à ceux du PJ subissent -2 à leurs tests d'attaque contre lui.", active: true },
      { name: 'Charge', description: "Déplacement de 5 à 20m en ligne droite + attaque au contact avec +2 en attaque et +1d6 DM.", active: true },
      { name: 'Rage du berserk', description: "Rage pour tout le combat : +2 en attaque, +1d6 DM, -4 DEF. Ne peut fuir ni attaquer à distance.", active: true },
      { name: 'Même pas mal', description: "Sur un coup critique reçu, entre en rage (action gratuite) et gagne +1d6 DM en contact pour les 3 prochains tours.", active: true },
      { name: 'Attaque tourbillon', description: "1 fois/combat, inflige automatiquement les DM de l'arme à toutes les cibles dans un rayon de 5m.", active: true },
    ],
  },
  {
    id: 'voie-de-la-guerre',
    name: 'Voie de la guerre',
    family: 'combattants',
    capacites: [
      { name: 'Posture de combat', description: "Au début du tour, redistribue jusqu'à -1/rang en attaque, DEF ou DM pour gagner l'équivalent dans une autre catégorie.", active: true },
      { name: 'Désarmer', description: "Attaque opposée au contact : si le PJ gagne, l'arme adverse tombe au sol (action de mouvement pour la ramasser).", active: true },
      { name: 'Double attaque', description: "Deux attaques au contact ce tour avec -2 à chacune.", active: true },
      { name: 'Attaque circulaire', description: "Tente une attaque au contact contre chaque adversaire engagé à portée.", active: true },
      { name: 'Attaque puissante', description: "Utilise 1d12 en attaque au lieu du d20. Si réussie, ajoute +2d6 aux DM. Compatible avec Double attaque.", active: true },
    ],
  },
  {
    id: 'voie-de-la-maitrise-des-armes',
    name: 'Voie de la maîtrise des armes',
    family: 'combattants',
    capacites: [
      { name: 'Arme de prédilection', description: "Choisit une arme de prédilection et gagne +1 en attaque quand il l'utilise.", active: false, effects: [{ kind: 'favoriteWeapon', attack: 1 }] },
      { name: 'Science du critique', description: "Inflige des critiques sur un résultat de 19-20 (18-20 avec une rapière).", active: false, effects: [{ kind: 'critRange', min: 19, rapiere: 18 }] },
      { name: 'Spécialisation', description: "+2 aux DM quand il utilise son arme de prédilection.", active: false, effects: [{ kind: 'favoriteWeapon', damage: 2 }] },
      { name: 'Attaque parfaite', description: "Lance 2d20 en attaque au contact et garde le meilleur. Ajoute +1d6 aux DM.", active: true, effects: [{ kind: 'attackAdvantage' }] },
      { name: 'Riposte', description: "1 fois/tour, obtient une attaque gratuite quand un adversaire rate une attaque de contact contre lui.", active: true },
    ],
  },
  {
    id: 'voie-du-pugilat',
    name: 'Voie du pugilat',
    family: 'combattants',
    capacites: [
      { name: 'Poings de fer', description: "Combat à mains nues : peut utiliser le score d'attaque à distance. DM 1d6 (rang 1), 1d8 (rang 3), 1d10 (rang 5).", active: false },
      { name: 'Peau de pierre', description: "Bonus de DEF égal au Mod. de CON.", active: false, effects: [{ kind: 'def', bonus: { mod: 'constitution' } }] },
      { name: 'Peau d\'acier', description: "Réduit tous les DM subis de 2 points (minimum 1 DM par attaque).", active: false, effects: [{ kind: 'rd', bonus: 2 }] },
      { name: 'Déluge de coups', description: "Deux attaques à mains nues, ou trois attaques avec d12 en attaque pour chacune.", active: true },
      { name: 'Force héroïque', description: "+2 en FOR. Lance 2d20 à tous les tests de FOR et garde le meilleur.", active: false, effects: [{ kind: 'ability', ability: 'strength', bonus: 2 }, { kind: 'advantage', on: 'strength' }] },
    ],
  },
  {
    id: 'voie-de-la-puissance',
    name: 'Voie de la puissance',
    family: 'combattants',
    capacites: [
      { name: 'Argument de taille', description: "Ajoute Mod. FOR aux PV max et aux tests de CHA de persuasion et d'intimidation de ses alliés adjacents.", active: false, effects: [{ kind: 'hp', bonus: { mod: 'strength' } }] },
      { name: 'Tour de force', description: "+10 à un test de FOR au coût de 1d4 PV. En combat, peut dépenser 2d4 PV pour +2d6 DM (1 fois/combat).", active: true },
      { name: 'Attaque brutale', description: "Attaque avec -2 en attaque et +1d6 DM. Au rang 5, peut choisir -5 pour +2d6 DM.", active: true },
      { name: 'Briseur d\'os', description: "Critique sur 19-20. En cas de critique : en plus des DM doublés, la cible subit -2 à tous ses tests d'attaque, FOR et DEX.", active: false, effects: [{ kind: 'critRange', min: 19 }] },
      { name: 'Vitalité débordante', description: "Récupère 1d6 PV par heure tant qu'il lui reste au moins 1 PV.", active: false },
    ],
  },

  // ── AVENTURIERS ──────────────────────────────────────────────────────────
  {
    id: 'voie-de-lacrobatie',
    name: 'Voie de l\'acrobatie',
    family: 'aventuriers',
    capacites: [
      { name: 'Acrobate', description: "+5 aux tests de DEX pour acrobaties, équilibre, sauts et escalade.", active: false },
      { name: 'Grâce féline', description: "Ajoute le Mod. de CHA en DEF et en initiative en plus du Mod. de DEX habituel.", active: false, effects: [{ kind: 'def', bonus: { mod: 'charisma' } }, { kind: 'init', bonus: { mod: 'charisma' } }] },
      { name: 'Lanceur de couteau', description: "1 fois/tour, attaque gratuite à distance (portée 10m) avec un couteau ou une dague (1d4 DM).", active: true },
      { name: 'Esquive acrobatique', description: "1 fois/tour, test d'attaque à distance contre le score de l'attaquant pour éviter totalement les DM.", active: true },
      { name: 'Dextérité héroïque', description: "+2 en DEX. Lance 2d20 à tous les tests de DEX et garde le meilleur.", active: false, effects: [{ kind: 'ability', ability: 'dexterity', bonus: 2 }, { kind: 'advantage', on: 'dexterity' }] },
    ],
  },
  {
    id: 'voie-de-larbeletrie',
    name: 'Voie de l\'arbalètrie',
    family: 'aventuriers',
    capacites: [
      { name: 'Joli coup !', description: "Ignore les pénalités de couvert (-2 à -5). Ajoute +1 DM à portée optimale.", active: false },
      { name: 'Cadence de tir', description: "Recharger une arbalète lourde = action de mouvement. Légère ou de poing = action gratuite.", active: false },
      { name: 'Tir double', description: "Peut tirer avec deux arbalètes de poing sans pénalité. Même cible : un seul test avec +2 en attaque.", active: true },
      { name: 'As de la gâchette', description: "Quand le test d'attaque à distance avec une arbalète atteint 25 ou plus, ajoute +1d6 DM.", active: false },
      { name: 'Maîtrise de l\'arbalète', description: "À partir du rang 5, peut recharger deux arbalètes en une seule action.", active: false },
    ],
  },
  {
    id: 'voie-de-larcherie',
    name: 'Voie de l\'archerie',
    family: 'aventuriers',
    capacites: [
      { name: 'Sens affûtés', description: "+5 aux tests de SAG (perception). Ajoute le Mod. de SAG aux DM infligés avec un arc.", active: false, effects: [{ kind: 'bowDamage', mod: 'wisdom' }] },
      { name: 'Tir aveugle', description: "Peut attaquer un ennemi invisible ou dans le noir dont il connaît la position approximative, sans malus.", active: false },
      { name: 'Tir rapide', description: "Peut effectuer deux attaques à distance ce tour.", active: true },
      { name: 'Flèche de mort', description: "Lance 2d20 pour l'attaque et conserve le meilleur. Les DM de la flèche sont doublés.", active: true, effects: [{ kind: 'attackAdvantage' }] },
      { name: 'Dans le mille', description: "Utilise 1d12 en attaque à distance. Si réussie, ajoute +2d6 DM.", active: true },
    ],
  },
  {
    id: 'voie-de-lassassinat',
    name: 'Voie de l\'assassinat',
    family: 'aventuriers',
    capacites: [
      { name: 'Discrétion', description: "+5 aux tests de DEX pour passer inaperçu.", active: false },
      { name: 'Attaque sournoise', description: "Attaque dans le dos ou par surprise : +1d6 DM par rang dans cette voie (les dés ne sont pas doublés en cas de critique).", active: true },
      { name: 'Frappe chirurgicale', description: "Réduit le score nécessaire pour un critique de son Mod. d'INT (ex : avec Mod. INT+3, critique sur 17-20).", active: false },
      { name: 'Surprise', description: "N'est jamais surpris. Peut réaliser une Attaque sournoise comme action d'attaque simple contre un adversaire surpris.", active: true },
      { name: 'Botte secrète', description: "Quand un critique est obtenu en attaque au contact, l'attaque devient automatiquement une Attaque sournoise.", active: false },
    ],
  },
  {
    id: 'voie-du-boheme',
    name: 'Voie du bohème',
    family: 'aventuriers',
    capacites: [
      { name: 'Rumeurs et légendes', description: "+5 aux tests d'INT pour se souvenir d'informations historiques, politiques, géographiques ou occultes.", active: false },
      { name: 'Argumenter', description: "+5 aux tests de CHA pour convaincre, tromper, mentir ou séduire.", active: false },
      { name: 'Débrouillard', description: "+5 aux tests de survie en nature et aux tests de profession et d'artisanat.", active: false },
      { name: 'Déguisement', description: "Peut prendre l'apparence de toute créature de taille proche (±50 cm) avec les accessoires adéquats.", active: true },
      { name: 'Touche-à-tout', description: "Choisit n'importe quelle capacité de rang 1 à 3 dans une autre voie de combattant ou d'aventurier.", active: false },
    ],
  },
  {
    id: 'voie-du-charme',
    name: 'Voie du charme',
    family: 'aventuriers',
    capacites: [
      { name: 'Charmant', description: "+5 aux tests de CHA pour séduire, baratiner ou mentir.", active: false },
      { name: 'Provocation', description: "Test opposé CHA vs INT pour forcer une cible à l'attaquer ce tour. Peut riposter avec une attaque gratuite.", active: true },
      { name: 'Attaque flamboyante', description: "Attaque de contact avec un bonus en attaque et DM égal au Mod. de CHA, en plus du Mod. de FOR ou DEX.", active: true },
      { name: 'Suggestion', description: "1 fois/jour, test opposé CHA vs SAG pour contraindre une créature à exécuter une action pendant 24h.", active: true },
      { name: 'Charisme héroïque', description: "+2 en CHA. Lance 2d20 à tous les tests de CHA et garde le meilleur.", active: false, effects: [{ kind: 'ability', ability: 'charisma', bonus: 2 }, { kind: 'advantage', on: 'charisma' }] },
    ],
  },
  {
    id: 'voie-de-la-chasse',
    name: 'Voie de la chasse',
    family: 'aventuriers',
    capacites: [
      { name: 'Proche de la nature', description: "+5 aux tests de survie, discrétion et observation en milieu naturel. Obtient un loup compagnon.", active: false },
      { name: 'Pistage', description: "Peut pister et suivre des créatures dans la nature. Bonus aux tests de SAG pour lire les traces.", active: false },
      { name: 'Attaque éclair', description: "Attaque au contact très percutante : ajoute le Mod. de DEX en attaque et aux DM.", active: true },
      { name: 'Ennemis jurés', description: "Après avoir tué une créature, sa race devient ennemie jurée : +Mod. SAG en attaque, +1d6 DM contre elle.", active: false },
      { name: 'Perception héroïque', description: "+2 en SAG. Lance 2d20 à tous les tests de SAG et garde le meilleur.", active: false, effects: [{ kind: 'ability', ability: 'wisdom', bonus: 2 }, { kind: 'advantage', on: 'wisdom' }] },
    ],
  },
  {
    id: 'voie-du-compagnon-animal',
    name: 'Voie du compagnon animal',
    family: 'aventuriers',
    capacites: [
      { name: 'Pistage animal', description: "Le loup compagnon détecte les odeurs. Le PJ gagne +5 aux tests de SAG pour pister et suivre des traces.", active: false },
      { name: 'Surveillance', description: "Le loup prévient des attaques surprises : +5 aux tests de surprise et en initiative.", active: false, effects: [{ kind: 'init', bonus: 5 }] },
      { name: 'Combat', description: "Le loup combat comme un personnage et attaque en même temps que le PJ.", active: true },
      { name: 'Empathie animale', description: "Peut parler aux animaux. Quand il dépense un PR, son loup récupère aussi [1d8+Mod.CON+niveau] PV.", active: true },
      { name: 'Animal fabuleux', description: "Le loup devient un mâle alpha aux statistiques significativement améliorées. Mâle alpha : Init. 13, DEF 16, PV [niveau du PJ × 4], attaque au contact [niveau du PJ + 2], DM 1d6+3, FOR +3, DEX +1, CON* +3, INT −3, SAG* +2, CHA −2.", active: false },
    ],
  },
  {
    id: 'voie-de-lescrime',
    name: 'Voie de l\'escrime',
    family: 'aventuriers',
    capacites: [
      { name: 'Attaque en finesse', description: "Peut utiliser le score d'attaque à distance pour une attaque au contact avec une arme de duel ou une dague.", active: true },
      { name: 'Intelligence du combat', description: "Ajoute le Mod. d'INT en initiative et en DEF, en plus du Mod. de DEX habituel.", active: false, effects: [{ kind: 'def', bonus: { mod: 'intelligence' } }, { kind: 'init', bonus: { mod: 'intelligence' } }] },
      { name: 'Feinte', description: "Réalise une attaque fictive sans DM. Au tour suivant contre la même cible : +5 en attaque et +1d6 DM.", active: true },
      { name: 'Ambidextrie', description: "Utilise deux armes de duel sans pénalité. La main faible réalise une attaque gratuite supplémentaire par tour.", active: true },
      { name: 'Maîtrise de l\'escrime', description: "Maîtrise parfaite de l'escrime. Applique le bonus de DEF d'une main gauche à ses attaques.", active: false },
    ],
  },
  {
    id: 'voie-de-la-fourberie',
    name: 'Voie de la fourberie',
    family: 'aventuriers',
    capacites: [
      { name: 'Doigts agiles', description: "+5 aux tests de DEX pour crocheter, désamorcer, faire les poches et autres actions de précision.", active: false },
      { name: 'Détecter les pièges', description: "Test d'INT (difficulté 10, ou 15 pour les pièges magiques) pour détecter et contourner les pièges.", active: true },
      { name: 'Croc-en-jambe', description: "Sur un résultat de 17-20 en attaque de contact, fait chuter l'adversaire en plus des DM normaux.", active: false },
      { name: 'Attaque paralysante', description: "1 fois/combat, paralyse un adversaire de douleur pendant 1d4 tours (aucun DM infligé).", active: true },
      { name: 'Attaque en traître', description: "1 fois/tour, obtient une attaque gratuite quand un allié blesse une créature à portée de contact.", active: true },
    ],
  },

  // ── MYSTIQUES ────────────────────────────────────────────────────────────
  {
    id: 'voie-de-lalchimie',
    name: 'Voie de l\'alchimie',
    family: 'mystiques',
    capacites: [
      { name: 'Fortifiant', description: "Breuvage qui guérit [1d4+rang] PV et accorde +3 aux [rang+1] prochains tests (dans les 12h).", active: true },
      { name: 'Feu grégeois', description: "Lance une fiole (portée 10m, réussite automatique) qui explose dans un rayon de 3m : 1d6 DM/rang.", active: true },
      { name: 'Huile instable', description: "Applique sur une arme (action limitée) : +1d6 DM de feu pendant [5+Mod.INT] minutes.", active: true },
      { name: 'Élixir de guérison', description: "Prépare un élixir qui soigne [3d6+Mod.INT] PV, un empoisonnement ou une hémorragie.", active: true },
      { name: 'Élixirs de protection', description: "Prépare des potions de Peau d'écorce, Image décalée ou Protection contre les éléments.", active: true },
    ],
  },
  {
    id: 'voie-des-arts-druidiques',
    name: 'Voie des arts druidiques',
    family: 'mystiques',
    capacites: [
      { name: 'Langage des animaux', description: "Communique avec les animaux (communication primitive). +5 aux tests pour influencer un animal.", active: false },
      { name: 'Nuée d\'insectes', description: "Test d'attaque magique (portée 20m) : 1 DM/tour et -2 aux tests de la cible pendant [5+Mod.SAG] tours.", active: true, spell: true },
      { name: 'Le guetteur', description: "Reçoit un oiseau de proie compagnon. Lien télépathique, peut percevoir par ses sens avec +5 en perception.", active: false },
      { name: 'Masque du prédateur', description: "Prend les traits d'un fauve : Mod. INT en initiative, attaque et DM. Vision nocturne pendant [5+Mod.SAG] tours.", active: true, spell: true },
      { name: 'Sagesse héroïque', description: "+2 en SAG. Lance 2d20 à tous les tests de SAG et garde le meilleur.", active: false, effects: [{ kind: 'ability', ability: 'wisdom', bonus: 2 }, { kind: 'advantage', on: 'wisdom' }] },
    ],
  },
  {
    id: 'voie-de-la-divination',
    name: 'Voie de la divination',
    family: 'mystiques',
    capacites: [
      { name: 'Sixième sens', description: "N'est jamais surpris. +2 en initiative et en DEF.", active: false, effects: [{ kind: 'def', bonus: 2 }, { kind: 'init', bonus: 2 }] },
      { name: 'Détection de l\'invisible', description: "Pendant [5+Mod.SAG] tours, détecte les créatures invisibles et les sorts de Clairvoyance dans 30m.", active: true, spell: true },
      { name: 'Clairvoyance', description: "Voit et entend à distance dans un lieu connu tant qu'il se concentre (action limitée à chaque tour).", active: true, spell: true },
      { name: 'Prescience', description: "1 fois/combat, en fin de tour, annule tout ce qui s'est passé et rejoue le tour depuis le début.", active: true, spell: true },
      { name: 'Hyperconscience', description: "+2 en SAG et +2 en INT. Lance 2d20 à tous les tests de SAG ou INT et garde le meilleur.", active: false, effects: [{ kind: 'ability', ability: 'wisdom', bonus: 2 }, { kind: 'ability', ability: 'intelligence', bonus: 2 }, { kind: 'advantage', on: 'wisdom' }, { kind: 'advantage', on: 'intelligence' }] },
    ],
  },
  {
    id: 'voie-de-lenvoutement',
    name: 'Voie de l\'envoûtement',
    family: 'mystiques',
    capacites: [
      { name: 'Injonction', description: "Test d'attaque magique opposé : la cible doit exécuter un ordre simple et non dangereux pour elle.", active: true, spell: true },
      { name: 'Sommeil', description: "[1d6+Mod.INT] cibles dans une zone de 10m (portée 20m) s'endorment pendant [5+Mod.SAG] minutes.", active: true, spell: true },
      { name: 'Confusion', description: "Test d'attaque magique opposé (portée 20m) : la cible agit aléatoirement pendant [3+Mod.SAG] tours (1-3 : n'agit pas, 4-6 : attaque le plus proche).", active: true, spell: true },
      { name: 'Amitié', description: "Test d'attaque magique (portée 10m) : la cible humanoïde se comporte comme un ami tant qu'elle n'est pas attaquée.", active: true, spell: true },
      { name: 'Domination', description: "Test d'attaque magique opposé (portée 20m) : prend le contrôle total de la cible.", active: true, spell: true },
    ],
  },
  {
    id: 'voie-des-forets',
    name: 'Voie des forêts',
    family: 'mystiques',
    capacites: [
      { name: 'Peau d\'écorce', description: "La peau se transforme en écorce : +2 DEF pendant [5+Mod.SAG] tours (passe à +4 au rang 4).", active: true, spell: true },
      { name: 'Prison végétale', description: "La végétation entrave les ennemis dans une zone de 10m (portée 20m) pendant [5+Mod.SAG] tours : -2 en attaque et DEF.", active: true, spell: true },
      { name: 'Baies magiques', description: "Fait pousser [1d6+Mod.INT] fruits guérissant chacun [1d10+niveau] PV à celui qui les consomme.", active: true, spell: true },
      { name: 'Animation d\'un arbre', description: "1 fois/combat, anime un arbre qui combat pendant [niveau] tours.", active: true, spell: true },
      { name: 'Régénération', description: "La cible touchée récupère 3 PV par tour pendant [niveau+Mod.SAG] tours (1 fois/jour par cible).", active: true, spell: true },
    ],
  },
  {
    id: 'voie-des-illusions',
    name: 'Voie des illusions',
    family: 'mystiques',
    capacites: [
      { name: 'Image décalée', description: "Pendant [5+Mod.SAG] tours, sur un toucher, lance 1d6 : sur 5-6, n'encaisse pas les DM.", active: true, spell: true },
      { name: 'Mirage', description: "Crée une illusion visuelle et sonore immobile (durée [5+Mod.SAG] min, volume 10m²/rang, portée 500m).", active: true, spell: true },
      { name: 'Imitation', description: "Prend l'apparence d'une créature de taille proche (±50cm) vue au moment de l'incantation, pendant [5+Mod.SAG] min.", active: true, spell: true },
      { name: 'Dédoublement', description: "Crée un double translucide d'une cible (portée 20m) sous son contrôle. Le double a les mêmes carac. mais la moitié des PV.", active: true, spell: true },
      { name: 'Tueur fantasmagorique', description: "Test d'attaque magique opposé (portée 20m) : invoque les pires terreurs de la cible, peut la tuer si elle échoue.", active: true, spell: true },
    ],
  },
  {
    id: 'voie-de-la-magie-elementaliste',
    name: 'Voie de la magie élémentaliste',
    family: 'mystiques',
    capacites: [
      { name: 'Brumes', description: "Crée un brouillard dense (portée 20m, zone 20m de diamètre) réduisant fortement la visibilité.", active: true, spell: true },
      { name: 'Sous tension', description: "Charge électrique pendant [5+Mod.SAG] tours : 1d6 DM à quiconque le touche au contact.", active: true, spell: true },
      { name: 'Armure de terre', description: "Pendant [5+Mod.SAG] tours, réduit tous les DM élémentaires (feu, froid, électricité, acide) de 2×rang.", active: true, spell: true },
      { name: 'Boule de feu', description: "Portée 30m, zone 6m de rayon : test d'attaque magique contre chaque cible dans la zone pour [4d6+Mod.INT] DM.", active: true, spell: true },
      { name: 'Intelligence héroïque', description: "+2 en INT. Lance 2d20 à tous les tests d'INT et garde le meilleur.", active: false, effects: [{ kind: 'ability', ability: 'intelligence', bonus: 2 }, { kind: 'advantage', on: 'intelligence' }] },
    ],
  },
  {
    id: 'voie-de-la-magie-runique',
    name: 'Voie de la magie runique',
    family: 'mystiques',
    capacites: [
      { name: 'Forgeron', description: "+5 en orfèvrerie et forge. En action de mouvement, enflamme son arme : +1 DM de feu/rang pendant [5+Mod.SAG] tours.", active: true, spell: true },
      { name: 'Rune d\'énergie', description: "Rituel de 5 min : enchante un bijou pour 24h. Permet de relancer un d20 1 fois/combat.", active: true, spell: true },
      { name: 'Rune de puissance', description: "Rituel de 5 min : enchante une arme pour 24h. Les DM sont au maximum 1 fois/combat.", active: true, spell: true },
      { name: 'Rune de garde', description: "Inscrit une rune et piège une zone (2-10m de diamètre). Toute créature qui entre déclenche un effet choisi.", active: true, spell: true },
      { name: 'Rune de tradition', description: "Enchante des objets : crée une arme ou armure magique de niveau [arrondi(niveau/3)] au maximum.", active: true },
    ],
  },
  {
    id: 'voie-du-mysticisme',
    name: 'Voie du mysticisme',
    family: 'mystiques',
    capacites: [
      { name: 'Bénédiction', description: "Chant d'encouragement : le PJ et ses alliés en vue gagnent +1 à tous leurs tests de Carac. et d'attaque pendant [3+Mod.SAG] tours.", active: true, spell: true },
      { name: 'Protection contre le mal', description: "+2 DEF et aux tests de résistance contre les morts-vivants, les démons et les créatures élémentaires (durée : 1 combat).", active: true, spell: true },
      { name: 'Délivrance', description: "En touchant la cible, annule les effets de sorts, malédictions, pétrification et capacités spéciales.", active: true, spell: true },
      { name: 'Sanctuaire', description: "Les adversaires doivent réussir un test de SAG (difficulté 15) pour attaquer le PJ pendant [5+Mod.SAG] tours.", active: true, spell: true },
      { name: 'Rituel de puissance', description: "Utilise 1d12 en attaque magique au lieu du d20. Si réussie, ajoute +2d6 DM.", active: true },
    ],
  },
  {
    id: 'voie-des-sombres-savoirs',
    name: 'Voie des sombres savoirs',
    family: 'mystiques',
    capacites: [
      { name: 'Saignements', description: "Test d'attaque magique (portée 10m) : 1d6 DM/tour pendant [rang] tours, ignore la réduction de dégâts.", active: true, spell: true },
      { name: 'Malédiction', description: "Test d'attaque magique (portée 20m) : la cible lance 2d20 à tous ses tests et garde le résultat le plus faible.", active: true, spell: true },
      { name: 'Pacte sanglant', description: "Action gratuite : sacrifie 1d4 PV pour obtenir +3 sur un jet de d20 ou en DEF contre une attaque.", active: true, spell: true },
      { name: 'Hémorragie', description: "Test d'attaque magique (portée 10m) : +1d6 DM sur toutes les attaques sanglantes reçues par la cible pendant [5+Mod.SAG] tours.", active: true, spell: true },
      { name: 'Invocation d\'un démon', description: "1 fois/combat, sacrifie 1d6 PV pour invoquer un démon sous ses ordres pendant [5+Mod.SAG] tours.", active: true, spell: true },
    ],
  },

  // ── PRESTIGE ─────────────────────────────────────────────────────────────
  // Niveau 8 requis, 2 points par rang. Chaque voie garde sa famille du livre (p. 118).

  // Famille des combattants
  {
    id: 'voie-des-armes-lourdes',
    name: 'Voie des armes lourdes',
    family: 'combattants',
    prestige: true,
    capacites: [
      { name: 'Allonge', description: "+1 en attaque et +5 en initiative avec une arme à deux mains.", active: false },
      { name: 'Frappe massive', description: "Action limitée : attaque avec +1d6 DM. La cible doit réussir un test opposé de FOR ou être renversée.", active: true },
      { name: 'Tenir à distance', description: "Action limitée : attaque et utilise son allonge ce tour. +5 DEF contre les attaques de contact.", active: true },
      { name: 'Attaque à outrance', description: "Choisit -2 DEF pour +1d6 DM, ou -5 DEF pour +2d6 DM. Ce bonus n'est pas multiplié en cas de critique.", active: true },
      { name: 'Critique destructeur', description: "Critique avec une arme à deux mains : +2d6 DM en plus des effets normaux du critique.", active: false },
    ],
  },
  {
    id: 'voie-de-la-danse-de-guerre',
    name: 'Voie de la danse de guerre',
    family: 'combattants',
    prestige: true,
    capacites: [
      { name: 'Pirouette', description: "+2 en DEF grâce à des pas de danse insaisissables. +5 aux tests de danse et d'acrobatie.", active: false, effects: [{ kind: 'def', bonus: 2 }] },
      { name: 'Vent des lames', description: "Peut utiliser le Mod. de DEX au lieu du Mod. de FOR en attaque au contact OU aux DM (pas les deux), avec une arme de guerre ou d'hast.", active: false },
      { name: 'Attaque en mouvement', description: "À chaque action limitée, peut en plus se déplacer de 10m avant ou après.", active: false },
      { name: 'Danse de lames', description: "Action limitée : entre en transe pour le reste du combat. +2 en attaque et DEF, et une attaque gratuite supplémentaire par tour (d12 en attaque). Peut arrêter quand il veut, mais pas recommencer avant le prochain combat. Un critique reçu stoppe la transe.", active: true },
      { name: 'Volte-face', description: "À chaque tour où le PJ attaque une cible différente du tour précédent : +2 en attaque et +1d6 DM.", active: false },
    ],
  },
  {
    id: 'voie-du-dogme-de-pierre',
    name: 'Voie du dogme de pierre',
    family: 'combattants',
    prestige: true,
    capacites: [
      { name: 'Indéracinable', description: "Ne peut plus être renversé ou projeté contre son gré. +1 en DEF (passe à +2 au rang 3).", active: false, effects: [{ kind: 'def', bonus: 1 }, { kind: 'def', bonus: 1, fromRank: 3 }] },
      { name: 'Sens de la pierre', description: "Sent la position de toutes les créatures en contact avec le sol ou les murs dans un rayon de 20m, même dans le noir ou invisibles. Ne peut plus être surpris par un adversaire au sol.", active: false },
      { name: 'Frappe de la pierre', description: "Un résultat de 1 sur un dé de DM d'une attaque de contact est remplacé par le maximum du dé.", active: false },
      { name: 'Attaque pétrifiante', description: "Action limitée : attaque au contact à mains nues. Si elle touche, la cible fait un test de CON difficulté [10 + rang] ou est pétrifiée 1d6 minutes (-5 aux DM qu'elle subit, l'effet cesse si elle perd plus de 5 PV). 1 fois par combat et par créature.", active: true },
      { name: 'Corps de pierre', description: "Action limitée : pendant [1d6+Mod.SAG] tours, -5 aux DM subis par des armes. Une créature qui l'attaque avec des armes naturelles subit 1 DM. Une arme manufacturée se brise sur un 1 au dé de DM.", active: true },
    ],
  },
  {
    id: 'voie-de-lordre-aile',
    name: 'Voie de l\'ordre ailé',
    family: 'combattants',
    prestige: true,
    capacites: [
      { name: 'Ordre de chevalerie', description: "Choix irréversible d'un ordre et d'une monture volante, qui fixe l'élément (dragon : feu, griffon : foudre, aspic : poison). Reçoit la monture, des insignes, une arme marquée et le rang 5 de la voie du combat monté. S'il l'a déjà : +5 en persuasion et intimidation (+10 sur sa monture).", active: false },
      { name: 'Arme élémentaire', description: "Action limitée : nimbe son arme d'une aura de son élément pendant [5+Mod.SAG] tours. +1d6 DM élémentaires.", active: true },
      { name: 'Résistance élémentaire', description: "Retranche 5 points aux DM de son élément (10 au rang 5 de la voie).", active: false },
      { name: 'Monture puissante', description: "La monture atteint sa pleine maturité : FOR +7, DEX +2, CON +7, INT -2, SAG +1, CHA +0, Init. 15, DEF 18, PV 20 + [5 × niveau], attaque +12, DM 2d6+7.", active: false },
      { name: 'Souffle élémentaire', description: "La monture souffle avec son action d'attaque (portée 40m) : si elle touche, 4d6 DM à la cible et 2d6 à toutes les cibles à moins de 3m. Si elle rate, 1d6 à toutes.", active: true },
    ],
  },
  {
    id: 'voie-de-la-purification',
    name: 'Voie de la purification',
    family: 'combattants',
    prestige: true,
    capacites: [
      { name: 'Sentir la corruption', description: "Action limitée : test de SAG difficulté 15 pour savoir si une créature à 30m a des pouvoirs paranormaux. Les humanoïdes résistent par un test opposé d'INT. Un seul essai par créature.", active: true },
      { name: 'Combattre la corruption', description: "+1 en attaque et aux DM contre les morts-vivants, les démons et les animaux corrompus (+2 au rang 4).", active: false },
      { name: 'Chasseur de sorcières', description: "+2 en DEF contre les attaques magiques et +2 aux DM contre les mystiques.", active: false },
      { name: 'Frappe préventive', description: "Attaque normale. En plus, la cible fait un test d'INT difficulté 15 ou ne peut utiliser aucun pouvoir magique ou extraordinaire à son prochain tour.", active: true },
      { name: 'Résister à la corruption', description: "1 fois par combat, résiste totalement à un sort ou effet magique au choix. Immunisé aux effets de corruption (drain, affaiblissement, pourriture, poison, maladie) des morts-vivants, démons et créatures corrompues.", active: true },
    ],
  },
  {
    id: 'voie-de-la-rage-ancestrale',
    name: 'Voie de la rage ancestrale',
    family: 'combattants',
    prestige: true,
    capacites: [
      { name: 'Fureur au combat', description: "+5 aux tests d'intimidation et gagne le rang 1 de la voie de la férocité. S'il l'a déjà : ajoute ce bonus à sa FOR pour le Cri de guerre, qui devient une action de mouvement (l'avancé, une action gratuite).", active: false },
      { name: 'Furie du Berserker', description: "Action limitée. Gagne le rang 3 de la voie de la férocité. S'il l'a déjà, la rage devient la Furie : +3 en attaque, +2d6 DM, -6 DEF. Test de SAG difficulté 16 pour en sortir avant la fin.", active: true },
      { name: 'Étreinte mortelle', description: "1 fois par combat, attrape un adversaire de taille égale ou inférieure : attaque au contact, [2d6+Mod.FOR] DM (+ bonus de rage). La cible est immobilisée (-5 DEF, aucune action sauf un test de FOR opposé pour se libérer). Les DM reviennent chaque tour sans jet d'attaque.", active: true },
      { name: 'Rage froide', description: "Garde sa lucidité en rage ou en furie : aucune pénalité de DEF, peut utiliser des armes de jet (pas d'arc ni d'arbalète, pas de négociation).", active: false },
      { name: 'Assaut final', description: "En rage ou en furie depuis au moins 3 tours : double tous les DM d'une attaque (rage comprise), à annoncer après le jet d'attaque. La rage s'arrête et ne peut plus reprendre de ce combat.", active: true },
    ],
  },
  {
    id: 'voie-du-sang-draconique',
    name: 'Voie du sang draconique',
    family: 'combattants',
    prestige: true,
    capacites: [
      { name: 'Ascendance draconique', description: "Retranche 5 points aux DM de feu (10 au rang 4).", active: false },
      { name: 'Férocité', description: "Action limitée : pendant [1d6+Mod.SAG] tours, FOR à 18 (ou +2 si déjà 18 ou plus) et attaque de griffes au contact : [1d6+Mod.FOR] DM.", active: true },
      { name: 'Souffle du dragon', description: "1 fois par combat, action d'attaque : cône de feu (5m de portée, 5m de large), 2d6 DM par rang dans cette voie. Test de DEX difficulté [10 + rang] pour diviser les DM par 2.", active: true },
      { name: 'Armure naturelle', description: "Sous la moitié de ses PV : retranche 5 points à tous les types de DM.", active: false },
      { name: 'Ailes de dragon', description: "Action limitée, 1 fois par jour : ailes de dragon pendant [1d6+Mod.SAG] minutes. Vol à 30m par action de mouvement, surplace gratuit. Chaque nouvelle utilisation coûte d'abord 1 PR.", active: true },
    ],
  },

  // Famille des aventuriers
  {
    id: 'voie-de-larcherie-arcanique',
    name: 'Voie de l\'archerie arcanique',
    family: 'aventuriers',
    prestige: true,
    capacites: [
      { name: 'Flèche magique', description: "Les flèches sont magiques. Sur un 1 au dé de DM, relance le dé et garde le second résultat.", active: false },
      { name: 'Flèche tueuse', description: "Fabrique en 1 jour une flèche pour un ennemi nommé (une seule à la fois). Contre lui : +3 en attaque et +1d6 DM par rang dans cette voie. Bonus doublés si la flèche a plus d'un an.", active: true },
      { name: 'Flèche animiste', description: "1 fois par combat, action d'attaque : lance à portée d'arc une Prison végétale avancée (voie des forêts, rang 2) sans dépenser de PM.", active: true },
      { name: 'Flèche vivante', description: "Sur 15-20 au test d'attaque (10-12 sur un d12) : +2d6 DM. La flèche devient un arbuste à la mort de la victime.", active: false },
      { name: 'Flèche intangible', description: "Action limitée : la flèche traverse les obstacles. La difficulté est le score de DEX de la cible au lieu de sa DEF, sans pénalité de couverture. Peut tirer à travers un mur s'il sait où est la cible.", active: true },
    ],
  },
  {
    id: 'voie-de-laudace',
    name: 'Voie de l\'audace',
    family: 'aventuriers',
    prestige: true,
    capacites: [
      { name: 'L\'amour du risque', description: "Dans un lieu dangereux (bord d'un précipice, lac de lave…) : +3 à tous les tests au d20 (attaque, carac.) et pour résister à la peur.", active: false },
      { name: 'Mouche du coche', description: "Sacrifie 1 ou 2 actions de mouvement pour +3 ou +6 en DEF jusqu'à son prochain tour.", active: true },
      { name: 'Ça passe ou ça casse', description: "Quand un test de carac. peut avoir une issue fatale, lance un d20 de plus et garde celui qu'il préfère.", active: false },
      { name: 'Poussée d\'adrénaline', description: "Dépense 1d4 PV pour gagner une action de mouvement de plus ce tour. Avec Mouche du coche : jusqu'à +10 en DEF.", active: true },
      { name: 'Attaque kamikaze', description: "Action limitée : test de DEX contre la moitié de la DEF de la cible au lieu d'un test d'attaque. DM normaux + bonus selon la taille : moyenne +1d6, grande +2d6, très grande +3d6, gigantesque +4d6, colossale +5d6 (petite : rien). Ensuite -5 DEF pendant 1 tour.", active: true },
    ],
  },
  {
    id: 'voie-du-duel',
    name: 'Voie du duel',
    family: 'aventuriers',
    prestige: true,
    capacites: [
      { name: 'Vives lames', description: "Peut utiliser le Mod. de DEX au lieu du Mod. de FOR en attaque au contact OU aux DM (pas les deux), avec une arme de duel ou une épée.", active: false },
      { name: 'Défi', description: "Action limitée, 1 fois par combat : défie une cible à 30m. +2 en attaque et en DEF contre elle pour le reste du combat.", active: true },
      { name: 'Juste toi et moi', description: "À chaque tour où il attaque la cible défiée : +1 DEF par rang dans cette voie contre les attaques des autres adversaires.", active: false },
      { name: 'Parade', description: "1 fois par tour, pare une attaque au contact de l'adversaire défié avec un test d'attaque au contact au moins égal au sien.", active: true },
      { name: 'Duel mental', description: "1 fois par tour, test opposé d'INT contre un adversaire au contact. S'il gagne, peut relancer un dé d'attaque ou de DM contre lui jusqu'à la fin du tour.", active: true },
    ],
  },
  {
    id: 'voie-de-la-flibusterie',
    name: 'Voie de la flibusterie',
    family: 'aventuriers',
    prestige: true,
    capacites: [
      { name: 'Équilibriste', description: "+5 aux tests de DEX sur un bateau ou un support mobile (chariot, cordages, ponts de corde) et +5 en natation et navigation.", active: false },
      { name: 'Coup de crosse', description: "1 fois par tour, attaque gratuite avec la crosse d'une arbalète déchargée (d12 en attaque, [1d4+Mod.FOR] DM).", active: true },
      { name: 'À l\'abordage !', description: "Première attaque au contact du combat : +5 en attaque et +2d6 DM.", active: false },
      { name: 'Sabre au poing', description: "Peut tirer avec une arbalète de poing d'une main et attaquer au contact avec l'autre arme sans pénalité.", active: false },
      { name: 'Pas de quartier', description: "Attaque gratuite (+5 en attaque, +1d6 DM) contre toute créature à son contact qui utilise une action de mouvement pour s'éloigner.", active: true },
    ],
  },
  {
    id: 'voie-de-la-lycanthropie',
    name: 'Voie de la lycanthropie',
    family: 'aventuriers',
    prestige: true,
    capacites: [
      { name: 'Forme hybride', description: "Action limitée : forme hybride pendant [5×Mod.SAG] tours (choix lupin ou félin au rang 1, irréversible). Plus d'armes, l'armure s'adapte. Lupine : FOR +2, griffes [2d6+Mod.FOR] et morsure [1d6+Mod.FOR]. Féline : DEX +2, griffes [2d4+Mod.FOR ou DEX] (contact ou distance) et morsure [1d4+Mod.FOR ou DEX]. Les deux attaques en une action d'attaque.", active: true },
      { name: 'Éventration', description: "Si ses deux attaques touchent et blessent : +2d6 DM sur la seconde.", active: false },
      { name: 'Forme animale', description: "Action limitée : loup ou panthère, 1h par niveau et par jour. Loup : Init. 17, DEF 15, DM 1d6+3, FOR +3, DEX +1, +5 en perception. Panthère : Init. 23, DEF 16, DM 1d6+2, FOR +2, DEX +4, Attaque bondissante (L) : jusqu'à 30m, +5 en attaque et +2d6 DM. Passer à la forme hybride : action de mouvement.", active: true },
      { name: 'Odeur du sang', description: "+1 en attaque et aux DM par tranche de 10 PV que le PJ a perdus dans ce combat, contre la cible qui les lui a infligés (max +5). Annulé si cette cible meurt.", active: false },
      { name: 'Fourrure d\'acier', description: "Sous forme animale ou hybride : +3 en DEF et RD 3.", active: false },
    ],
  },
  {
    id: 'voie-des-poisons',
    name: 'Voie des poisons',
    family: 'aventuriers',
    prestige: true,
    capacites: [
      { name: 'Connaissance du poison', description: "Test d'INT difficulté 10 pour reconnaître, identifier ou détecter un poison. Applique un poison sur une arme sans test.", active: false },
      { name: 'Poison rapide', description: "Avant chaque combat, enduit jusqu'à 3 armes. La première attaque réussie inflige +2d6 DM (3d6 au rang 4). Test de CON difficulté [10 + rang] : la victime ne subit que la moitié.", active: true },
      { name: 'Poison affaiblissant', description: "Remplace le poison rapide. Sur la première attaque réussie, la victime fait un test de CON difficulté 15 ou est affaiblie (d12 à tous ses tests) pour le reste du combat.", active: true },
      { name: 'Résistance au poison', description: "Quand il est empoisonné, test de CON difficulté 10 : réussite = aucun effet, échec = effets divisés par 2.", active: false },
      { name: 'Poisons virulents', description: "Fabrique les poisons lent et violent : [1+Mod.INT] doses par jour au total. Difficulté pour y résister : [12+Mod.INT].", active: true },
    ],
  },
  {
    id: 'voie-des-rituels',
    name: 'Voie des rituels',
    family: 'aventuriers',
    prestige: true,
    capacites: [
      { name: 'Premier rituel', description: "Apprend un rituel au choix parmi : Animation des morts (parler 1h avec un mort de moins de [rang×4] jours), Communion de l'esprit (voir et entendre par les yeux d'une cible), L'eau des sens (parler à distance aux gens restés près d'une source enchantée), Sanctuaire (rien ni aucun sort n'entre dans un cercle de 20m tant qu'il reste concentré), Imitation (prend l'apparence d'une cible pendant 6h). Un rituel ne coûte aucun PM mais demande au moins 30 minutes.", active: false },
      { name: 'Deuxième rituel', description: "Apprend un autre rituel de la liste.", active: false },
      { name: 'Troisième rituel', description: "Apprend un autre rituel de la liste.", active: false },
      { name: 'Quatrième rituel', description: "Apprend un autre rituel de la liste.", active: false },
      { name: 'Cinquième rituel', description: "Apprend le dernier rituel de la liste.", active: false },
    ],
  },

  // Famille des mystiques
  {
    id: 'voie-des-arcanes',
    name: 'Voie des arcanes',
    family: 'mystiques',
    prestige: true,
    capacites: [
      { name: 'Invisibilité', description: "Invisible pendant [1d6+Mod.SAG] minutes : personne ne peut le détecter ni l'attaquer. Redevient visible s'il attaque ou lance un sort.", active: true, spell: true },
      { name: 'Hâte', description: "Pendant [1d6+Mod.SAG] tours, à partir du tour suivant : une action de plus par tour (attaque normale ou mouvement). Toujours une seule action limitée par tour.", active: true, spell: true },
      { name: 'Foudre', description: "Éclair sur une ligne de 10m : test d'attaque magique contre chaque créature sur la ligne, [5d6+Mod.INT] DM. Test de DEX difficulté [12+Mod.INT] pour diviser les DM par 2.", active: true, spell: true },
      { name: 'Téléportation', description: "Réapparaît à moins de [INT×10] mètres, en ligne de vue ou dans un lieu parfaitement connu. Avec un rituel d'1h : [INT×10] km, vers un lieu plat et désert.", active: true, spell: true },
      { name: 'Désintégration', description: "Rayon à portée 20m : test d'attaque magique, [6d6+Mod.INT] DM. Peut réduire en poussière un objet normal (-5 pour viser un objet porté, 50 kg max, sans effet sur les objets de tradition ou légendaires).", active: true, spell: true },
    ],
  },
  {
    id: 'voie-des-arts-primitifs',
    name: 'Voie des arts primitifs',
    family: 'mystiques',
    prestige: true,
    capacites: [
      { name: 'Gri-gri', description: "Action limitée : sacrifie 1 PV sur un fétiche. Son porteur peut relancer 1d20 une fois dans les 12h. Si la perte du PV est permanente (PV max -1), une relance par jour, tous les jours. Maximum [rang] gris-gris.", active: true },
      { name: 'Ombre mortelle', description: "Test d'attaque magique (portée 20m) : l'ombre de la cible l'attaque pendant [3+Mod.SAG] tours, avec son attaque et la moitié de ses DM.", active: true, spell: true },
      { name: 'Magie du sang', description: "Sacrifie 1d4 PV pour lancer un sort plus vite : action d'attaque → action de mouvement, concentration → action d'attaque. Un 2e sort dans le tour coûte 1d4 PV de plus (max 3d4). Sorts de rang 3 maximum.", active: true },
      { name: 'Vents des âmes', description: "Pendant [Mod.SAG] tours, la cible subit 1d6 DM automatiques par tour et ne peut faire aucune action limitée sans réussir un test de SAG difficulté 15.", active: true, spell: true },
      { name: 'Mauvais œil', description: "En plus de ses actions, pose chaque tour le mauvais œil sur une cible visible : -2 à tous ses tests. Sur un 1 ou un 2 au d20, conséquences terribles (avec le MJ).", active: true },
    ],
  },
  {
    id: 'voie-des-cristaux',
    name: 'Voie des cristaux',
    family: 'mystiques',
    prestige: true,
    capacites: [
      { name: 'Premier cristal', description: "Apprend un cristal (200 pa chacun). Un cristal tourne autour du PJ (DEF 20, 10 PV, RD 5). Cristaux courants : +2 FOR, DEX, CON, INT, SAG ou CHA, +2 DEF, +1 en attaque, +5 Init., régénération 1 PV/h, résistance 10 au feu et au froid ou à l'acide et à l'électricité, vivre sans respirer, sans boire ni manger. 1 cristal actif à la fois.", active: false },
      { name: 'Deuxième cristal', description: "Apprend un cristal de plus. 2 cristaux actifs, pas deux fois le même.", active: false },
      { name: 'Troisième cristal', description: "Apprend deux cristaux de plus. 3 cristaux actifs, pas deux fois le même. Changer de cristal = action limitée.", active: false },
      { name: 'Quatrième cristal', description: "Apprend deux cristaux de plus. 4 cristaux actifs, pas deux fois le même.", active: false },
      { name: 'Cinquième cristal', description: "Apprend deux cristaux de plus. 5 cristaux actifs, au plus deux fois le même.", active: false },
    ],
  },
  {
    id: 'voie-des-elements',
    name: 'Voie des éléments',
    family: 'mystiques',
    prestige: true,
    capacites: [
      { name: 'Maîtrise élémentaire', description: "Maîtrise un élément au choix. Terre : ne peut plus être renversé, détecte les pièges creusés, +5 pour trouver pièges et passages secrets. Eau : marche sur l'eau. Air : respire partout. Eau et air se transmettent (action limitée, [rang] cibles, [1d6+Mod.SAG] min). Feu : immunisé au feu, DM de froid divisés par 2.", active: false },
      { name: 'Élément ou forme', description: "Maîtrise un élément de plus. Ou, à la place, apprend la Forme élémentaire (voir rang 5).", active: false },
      { name: 'Élément ou forme', description: "Maîtrise un élément de plus. Ou, à la place, apprend la Forme élémentaire (voir rang 5).", active: false },
      { name: 'Élément ou forme', description: "Maîtrise un élément de plus. Ou, à la place, apprend la Forme élémentaire (voir rang 5).", active: false },
      { name: 'Forme élémentaire', description: "1 fois par jour et par élément maîtrisé, pendant [5+Mod.SAG] minutes : RD = rang dans la voie. Feu : +2d6 DM de feu au contact, 1d6 DM à qui le frappe au contact. Eau : guérit 3 PV par tour, passe par le moindre interstice. Terre : +6 en FOR (+3 attaque, DM et tests de FOR) et en DEF. Air : vol à 30m par mouvement, DM physiques reçus et infligés divisés par 2. Peut s'apprendre dès le rang 2 à la place d'un élément. Toujours un sort de rang 4.", active: true, spell: true, spellRank: 4 },
    ],
  },
  {
    id: 'voie-de-la-glace',
    name: 'Voie de la glace',
    family: 'mystiques',
    prestige: true,
    capacites: [
      { name: 'Verglas', description: "Sol verglacé sur 10m de diamètre pour le combat. Test de DEX difficulté 10 pour rester debout, 15 pour s'y déplacer ou combattre. Se relever : DEX 15 et un tour.", active: true, spell: true },
      { name: 'Cœur de glace', description: "Action limitée : DM de froid et d'électricité divisés par 2 pour le reste du combat (10 tours hors combat).", active: true },
      { name: 'Cône de froid', description: "Cône de 20m de portée et 10m de large : [2d6+Mod.INT] DM de froid (4d6 au rang 5), ralenti 1 tour. Test de CON difficulté [10 + rang] : moitié des DM et pas ralenti.", active: true, spell: true },
      { name: 'Présence glaciale', description: "Pendant [1d6+Mod.SAG] minutes : +4 DEF, immunisé au froid, DM de feu divisés par 2. Qui le touche ou l'attaque au contact subit 1d6 DM. Gèle l'eau sous ses pas.", active: true, spell: true },
      { name: 'Tempête de cristal', description: "Cible à 40m : un test d'attaque magique contre la DEF de tous dans un rayon de 10m, alliés et PJ compris. Touchés : [5d6+Mod.INT] DM de froid et ralentis 1 tour (sauf CON 13). Ratés : moitié des DM.", active: true, spell: true },
    ],
  },
  {
    id: 'voie-de-la-metamorphose',
    name: 'Voie de la métamorphose',
    family: 'mystiques',
    prestige: true,
    capacites: [
      { name: 'Forme animale', description: "Animal petit (FOR -2, DEX +4, CON -2, DEF 15, Init. 19, attaque +4, DM 1d4-2) ou moyen (FOR +1, DEX +1, CON +1, DEF 14, Init. 12, attaque +2, DM 1d6+1). Garde PV, INT, SAG et CHA. Reprendre forme humanoïde : action limitée.", active: true, spell: true },
      { name: 'Transformation rapide', description: "Reprendre forme humanoïde, ou changer de forme ensuite, ne demande qu'une action de mouvement (le sort se paie quand même).", active: false },
      { name: 'Grande forme animale', description: "Grand animal (ours, tigre, griffon…) : FOR +8, CON +8, DEF 18, Init. 10, attaque +10, DM 2d6+8. +5 pour impressionner ou intimider.", active: true, spell: true },
      { name: 'Transformation régénérative', description: "En reprenant forme humanoïde par une action limitée après avoir été blessé sous forme animale : récupère 3d6 PV, sans dépasser les DM reçus sous cette forme.", active: true },
      { name: 'Forme animale énorme', description: "Animal énorme (éléphant, dragon…) : FOR +11, CON +11, DEF 20, Init. 10, attaque +15, DM 3d6+11, RD 2.", active: true, spell: true },
    ],
  },
  {
    id: 'voie-des-vermines',
    name: 'Voie des vermines',
    family: 'mystiques',
    prestige: true,
    capacites: [
      { name: 'Nuées de criquets', description: "Gagne le sort Nuée d'insectes (arts druidiques, rang 2). S'il l'a déjà : DM continus et malus augmentés de 1.", active: true, spell: true },
      { name: 'Compagnon vermine', description: "Adopte un scorpion géant ou une araignée géante comme compagnon permanent.", active: false },
      { name: 'Affinité au poison', description: "Enduit une arme tranchante ou perforante du venin. Sur une attaque au contact réussie : 1d6 DM au début de chaque tour de la cible, jusqu'à un test de CON difficulté [10 + Mod.INT du PJ] (réussite = immunisé 24h, pas de cumul). +5 aux tests de CON contre le poison.", active: true },
      { name: 'Vermine supérieure', description: "Le compagnon gagne Étreinte (scorpion) ou Toile (araignée).", active: false },
      { name: 'Maître vermine', description: "Communique avec toutes les vermines, qui le voient comme un ami. Peut monter sur son compagnon.", active: false },
    ],
  },
]

export const VOIES_BY_ID: Record<string, Voie> = Object.fromEntries(VOIES.map(v => [v.id, v]))

export const FAMILY_LABELS: Record<VoieFamily, string> = {
  combattants: 'Combattants',
  aventuriers: 'Aventuriers',
  mystiques: 'Mystiques',
}

export const FAMILY_ORDER: VoieFamily[] = ['combattants', 'aventuriers', 'mystiques']
