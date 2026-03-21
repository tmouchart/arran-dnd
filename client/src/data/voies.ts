export type VoieFamily = 'combattants' | 'aventuriers' | 'mystiques' | 'prestige'

export interface Capacite {
  name: string
  description: string
}

export interface Voie {
  id: string
  name: string
  family: VoieFamily
  capacites: [Capacite, Capacite, Capacite, Capacite, Capacite]
}

export const VOIES: Voie[] = [
  // ── COMBATTANTS ──────────────────────────────────────────────────────────
  {
    id: 'voie-du-bastion',
    name: 'Voie du bastion',
    family: 'combattants',
    capacites: [
      { name: 'Protéger un allié', description: "Accorde le Mod. de DEF de son bouclier à un compagnon adjacent. Peut changer de compagnon à chaque tour." },
      { name: 'Absorber un coup', description: "Après une action, peut effectuer un test d'attaque au contact en opposition pour annuler un coup reçu avant son prochain tour." },
      { name: 'Coup de bouclier', description: "Attaque gratuite au bouclier chaque tour avec d12, infligeant [1d4 + Mod. FOR] DM." },
      { name: 'Absorber un sort', description: "Après une action, peut effectuer un test d'attaque magique en opposition pour annuler un sort avant son prochain tour." },
      { name: 'Armure lourde', description: "Peut porter une armure de plaques (+7 DEF). Celle-ci le protège des attaques critiques (DM normaux au lieu de doublés)." },
    ],
  },
  {
    id: 'voie-de-la-bravoure',
    name: 'Voie de la bravoure',
    family: 'combattants',
    capacites: [
      { name: 'Robustesse', description: "+3 PV au rang 1, +3 PV au rang 3, +3 PV au rang 5." },
      { name: 'Armure naturelle', description: "Le corps est endurci : +2 en DEF." },
      { name: 'Prouesse', description: "1 fois/tour, sacrifier 1d4 PV pour +5 à un test de FOR ou DEX." },
      { name: 'Dernier rempart', description: "Ne réalise qu'une attaque ce tour mais obtient une attaque gratuite contre tout ennemi qui s'approche. Un ennemi blessé voit son déplacement arrêté." },
      { name: 'Constitution héroïque', description: "+2 en CON. Lance 2d20 à tous les tests de CON et garde le meilleur." },
    ],
  },
  {
    id: 'voie-du-combat-a-deux-armes',
    name: 'Voie du combat à deux armes',
    family: 'combattants',
    capacites: [
      { name: 'Combat à deux armes', description: "Attaque de chaque main : d20 pour la main directrice, d12 pour la main faible (arme légère max d6 DM)." },
      { name: 'Parade croisée', description: "+2 DEF ce tour avec une seule attaque. Résultat pair = main principale, impair = main faible." },
      { name: 'Symétrie', description: "Plus obligé de manier une arme légère en main faible (jusqu'à d8). Deux armes légères accordent un bonus supplémentaire." },
      { name: 'Double peine', description: "Si les deux armes atteignent la cible le même tour, +1d6 DM sur l'une des deux attaques." },
      { name: 'Combat à deux armes parfait', description: "Le combat à deux armes ne nécessite plus qu'une action d'attaque au lieu d'une action limitée." },
    ],
  },
  {
    id: 'voie-du-combat-monte',
    name: 'Voie du combat monté',
    family: 'combattants',
    capacites: [
      { name: 'Fidèle monture', description: "Possède un destrier puissant. En selle, peut ajouter un déplacement de 10m avant ou après une action." },
      { name: 'Cavalier émérite', description: "+2 en attaque au contact à cheval. Partage sa DEF avec la monture (garde le meilleur). Monter/descendre = action gratuite." },
      { name: 'Massacrer la piétaille', description: "+1d6 DM contre la piétaille (au moins 4 créatures similaires) lorsqu'il est en selle." },
      { name: 'Charge', description: "Déplacement de 40m en ligne droite et une attaque de contact. Doit parcourir au moins 10m avant d'attaquer." },
      { name: 'Monture fantastique', description: "Obtient une monture volante (aspic, dragon, griffon…). Peut faire attaquer sa monture en même temps que lui." },
    ],
  },
  {
    id: 'voie-du-commandement',
    name: 'Voie du commandement',
    family: 'combattants',
    capacites: [
      { name: 'Action concertée', description: "1 fois/tour, échange son initiative avec un PJ volontaire. Si le PJ cède son initiative, +1 en attaque." },
      { name: 'À couvert', description: "DM à distance et de zone divisés par 2, déplacement de 20m. Un allié adjacent peut en profiter." },
      { name: 'Exemplaire', description: "1 fois/tour, un allié combattant le même adversaire peut relancer un test d'attaque raté." },
      { name: 'Ordre de bataille', description: "1 fois/tour, octroie une action de mouvement ou d'attaque gratuite à un allié en vue." },
      { name: 'Charge fantastique', description: "1 fois/combat, le PJ et tous ses alliés en vue bougent de 20m en ligne droite et attaquent avec +3 et +1d6 DM." },
    ],
  },
  {
    id: 'voie-de-la-ferocite',
    name: 'Voie de la férocité',
    family: 'combattants',
    capacites: [
      { name: 'Cri de guerre', description: "1 fois/combat, les ennemis avec FOR ou PV max inférieurs à ceux du PJ subissent -2 à leurs tests d'attaque contre lui." },
      { name: 'Charge', description: "Déplacement de 5 à 20m en ligne droite + attaque au contact avec +2 en attaque et +1d6 DM." },
      { name: 'Rage du berserk', description: "Rage pour tout le combat : +2 en attaque, +1d6 DM, -4 DEF. Ne peut fuir ni attaquer à distance." },
      { name: 'Même pas mal', description: "Sur un coup critique reçu, entre en rage (action gratuite) et gagne +1d6 DM en contact pour les 3 prochains tours." },
      { name: 'Attaque tourbillon', description: "1 fois/combat, inflige automatiquement les DM de l'arme à toutes les cibles dans un rayon de 5m." },
    ],
  },
  {
    id: 'voie-de-la-guerre',
    name: 'Voie de la guerre',
    family: 'combattants',
    capacites: [
      { name: 'Posture de combat', description: "Au début du tour, redistribue jusqu'à -1/rang en attaque, DEF ou DM pour gagner l'équivalent dans une autre catégorie." },
      { name: 'Désarmer', description: "Attaque opposée au contact : si le PJ gagne, l'arme adverse tombe au sol (action de mouvement pour la ramasser)." },
      { name: 'Double attaque', description: "Deux attaques au contact ce tour avec -2 à chacune." },
      { name: 'Attaque circulaire', description: "Tente une attaque au contact contre chaque adversaire engagé à portée." },
      { name: 'Attaque puissante', description: "Utilise 1d12 en attaque au lieu du d20. Si réussie, ajoute +2d6 aux DM. Compatible avec Double attaque." },
    ],
  },
  {
    id: 'voie-de-la-maitrise-des-armes',
    name: 'Voie de la maîtrise des armes',
    family: 'combattants',
    capacites: [
      { name: 'Arme de prédilection', description: "Choisit une arme de prédilection et gagne +1 en attaque quand il l'utilise." },
      { name: 'Science du critique', description: "Inflige des critiques sur un résultat de 19-20 (18-20 avec une rapière)." },
      { name: 'Spécialisation', description: "+2 aux DM quand il utilise son arme de prédilection." },
      { name: 'Attaque parfaite', description: "Lance 2d20 en attaque au contact et garde le meilleur. Ajoute +1d6 aux DM." },
      { name: 'Riposte', description: "1 fois/tour, obtient une attaque gratuite quand un adversaire rate une attaque de contact contre lui." },
    ],
  },
  {
    id: 'voie-du-pugilat',
    name: 'Voie du pugilat',
    family: 'combattants',
    capacites: [
      { name: 'Poings de fer', description: "Combat à mains nues : peut utiliser le score d'attaque à distance. DM 1d6 (rang 1), 1d8 (rang 3), 1d10 (rang 5)." },
      { name: 'Peau de pierre', description: "Bonus de DEF égal au Mod. de CON." },
      { name: 'Peau d\'acier', description: "Réduit tous les DM subis de 2 points (minimum 1 DM par attaque)." },
      { name: 'Déluge de coups', description: "Deux attaques à mains nues, ou trois attaques avec d12 en attaque pour chacune." },
      { name: 'Force héroïque', description: "+2 en FOR. Lance 2d20 à tous les tests de FOR et garde le meilleur." },
    ],
  },
  {
    id: 'voie-de-la-puissance',
    name: 'Voie de la puissance',
    family: 'combattants',
    capacites: [
      { name: 'Argument de taille', description: "Ajoute Mod. FOR aux PV max et aux tests de CHA de persuasion et d'intimidation de ses alliés adjacents." },
      { name: 'Tour de force', description: "+10 à un test de FOR au coût de 1d4 PV. En combat, peut dépenser 2d4 PV pour +2d6 DM (1 fois/combat)." },
      { name: 'Attaque brutale', description: "Attaque avec -2 en attaque et +1d6 DM. Au rang 5, peut choisir -5 pour +2d6 DM." },
      { name: 'Briseur d\'os', description: "Critique sur 19-20. En cas de critique : en plus des DM doublés, la cible subit -2 à tous ses tests d'attaque, FOR et DEX." },
      { name: 'Vitalité débordante', description: "Récupère 1d6 PV par heure tant qu'il lui reste au moins 1 PV." },
    ],
  },

  // ── AVENTURIERS ──────────────────────────────────────────────────────────
  {
    id: 'voie-de-lacrobatie',
    name: 'Voie de l\'acrobatie',
    family: 'aventuriers',
    capacites: [
      { name: 'Acrobate', description: "+5 aux tests de DEX pour acrobaties, équilibre, sauts et escalade." },
      { name: 'Grâce féline', description: "Ajoute le Mod. de CHA en DEF et en initiative en plus du Mod. de DEX habituel." },
      { name: 'Lanceur de couteau', description: "1 fois/tour, attaque gratuite à distance (portée 10m) avec un couteau ou une dague (1d4 DM)." },
      { name: 'Esquive acrobatique', description: "1 fois/tour, test d'attaque à distance contre le score de l'attaquant pour éviter totalement les DM." },
      { name: 'Dextérité héroïque', description: "+2 en DEX. Lance 2d20 à tous les tests de DEX et garde le meilleur." },
    ],
  },
  {
    id: 'voie-de-larbeletrie',
    name: 'Voie de l\'arbalètrie',
    family: 'aventuriers',
    capacites: [
      { name: 'Joli coup !', description: "Ignore les pénalités de couvert (-2 à -5). Ajoute +1 DM à portée optimale." },
      { name: 'Cadence de tir', description: "Recharger une arbalète lourde = action de mouvement. Légère ou de poing = action gratuite." },
      { name: 'Tir double', description: "Peut tirer avec deux arbalètes de poing sans pénalité. Même cible : un seul test avec +2 en attaque." },
      { name: 'As de la gâchette', description: "Quand le test d'attaque à distance avec une arbalète atteint 25 ou plus, ajoute +1d6 DM." },
      { name: 'Maîtrise de l\'arbalète', description: "À partir du rang 5, peut recharger deux arbalètes en une seule action." },
    ],
  },
  {
    id: 'voie-de-larcherie',
    name: 'Voie de l\'archerie',
    family: 'aventuriers',
    capacites: [
      { name: 'Sens affûtés', description: "+5 aux tests de SAG (perception). Ajoute le Mod. de SAG aux DM infligés avec un arc." },
      { name: 'Tir aveugle', description: "Peut attaquer un ennemi invisible ou dans le noir dont il connaît la position approximative, sans malus." },
      { name: 'Tir rapide', description: "Peut effectuer deux attaques à distance ce tour." },
      { name: 'Flèche de mort', description: "Lance 2d20 pour l'attaque et conserve le meilleur. Les DM de la flèche sont doublés." },
      { name: 'Dans le mille', description: "Utilise 1d12 en attaque à distance. Si réussie, ajoute +2d6 DM." },
    ],
  },
  {
    id: 'voie-de-lassassinat',
    name: 'Voie de l\'assassinat',
    family: 'aventuriers',
    capacites: [
      { name: 'Discrétion', description: "+5 aux tests de DEX pour passer inaperçu." },
      { name: 'Attaque sournoise', description: "Attaque dans le dos ou par surprise : +1d6 DM par rang dans cette voie (les dés ne sont pas doublés en cas de critique)." },
      { name: 'Frappe chirurgicale', description: "Réduit le score nécessaire pour un critique de son Mod. d'INT (ex : avec Mod. INT+3, critique sur 17-20)." },
      { name: 'Surprise', description: "N'est jamais surpris. Peut réaliser une Attaque sournoise comme action d'attaque simple contre un adversaire surpris." },
      { name: 'Botte secrète', description: "Quand un critique est obtenu en attaque au contact, l'attaque devient automatiquement une Attaque sournoise." },
    ],
  },
  {
    id: 'voie-du-boheme',
    name: 'Voie du bohème',
    family: 'aventuriers',
    capacites: [
      { name: 'Rumeurs et légendes', description: "+5 aux tests d'INT pour se souvenir d'informations historiques, politiques, géographiques ou occultes." },
      { name: 'Argumenter', description: "+5 aux tests de CHA pour convaincre, tromper, mentir ou séduire." },
      { name: 'Débrouillard', description: "+5 aux tests de survie en nature et aux tests de profession et d'artisanat." },
      { name: 'Déguisement', description: "Peut prendre l'apparence de toute créature de taille proche (±50 cm) avec les accessoires adéquats." },
      { name: 'Touche-à-tout', description: "Choisit n'importe quelle capacité de rang 1 à 3 dans une autre voie de combattant ou d'aventurier." },
    ],
  },
  {
    id: 'voie-du-charme',
    name: 'Voie du charme',
    family: 'aventuriers',
    capacites: [
      { name: 'Charmant', description: "+5 aux tests de CHA pour séduire, baratiner ou mentir." },
      { name: 'Provocation', description: "Test opposé CHA vs INT pour forcer une cible à l'attaquer ce tour. Peut riposter avec une attaque gratuite." },
      { name: 'Attaque flamboyante', description: "Attaque de contact avec un bonus en attaque et DM égal au Mod. de CHA, en plus du Mod. de FOR ou DEX." },
      { name: 'Suggestion', description: "1 fois/jour, test opposé CHA vs SAG pour contraindre une créature à exécuter une action pendant 24h." },
      { name: 'Charisme héroïque', description: "+2 en CHA. Lance 2d20 à tous les tests de CHA et garde le meilleur." },
    ],
  },
  {
    id: 'voie-de-la-chasse',
    name: 'Voie de la chasse',
    family: 'aventuriers',
    capacites: [
      { name: 'Proche de la nature', description: "+5 aux tests de survie, discrétion et observation en milieu naturel. Obtient un loup compagnon." },
      { name: 'Pistage', description: "Peut pister et suivre des créatures dans la nature. Bonus aux tests de SAG pour lire les traces." },
      { name: 'Attaque éclair', description: "Attaque au contact très percutante : ajoute le Mod. de DEX en attaque et aux DM." },
      { name: 'Ennemis jurés', description: "Après avoir tué une créature, sa race devient ennemie jurée : +Mod. SAG en attaque, +1d6 DM contre elle." },
      { name: 'Perception héroïque', description: "+2 en SAG. Lance 2d20 à tous les tests de SAG et garde le meilleur." },
    ],
  },
  {
    id: 'voie-du-compagnon-animal',
    name: 'Voie du compagnon animal',
    family: 'aventuriers',
    capacites: [
      { name: 'Pistage animal', description: "Le loup compagnon détecte les odeurs. Le PJ gagne +5 aux tests de SAG pour pister et suivre des traces." },
      { name: 'Surveillance', description: "Le loup prévient des attaques surprises : +5 aux tests de surprise et en initiative." },
      { name: 'Combat', description: "Le loup combat comme un personnage et attaque en même temps que le PJ." },
      { name: 'Empathie animale', description: "Peut parler aux animaux. Quand il dépense un PR, son loup récupère aussi [1d8+Mod.CON+niveau] PV." },
      { name: 'Animal fabuleux', description: "Le loup devient un mâle alpha aux statistiques significativement améliorées. Mâle alpha : Init. 13, DEF 16, PV [niveau du PJ × 4], attaque au contact [niveau du PJ + 2], DM 1d6+3, FOR +3, DEX +1, CON* +3, INT −3, SAG* +2, CHA −2." },
    ],
  },
  {
    id: 'voie-de-lescrime',
    name: 'Voie de l\'escrime',
    family: 'aventuriers',
    capacites: [
      { name: 'Attaque en finesse', description: "Peut utiliser le score d'attaque à distance pour une attaque au contact avec une arme de duel ou une dague." },
      { name: 'Intelligence du combat', description: "Ajoute le Mod. d'INT en initiative et en DEF, en plus du Mod. de DEX habituel." },
      { name: 'Feinte', description: "Réalise une attaque fictive sans DM. Au tour suivant contre la même cible : +5 en attaque et +1d6 DM." },
      { name: 'Ambidextrie', description: "Utilise deux armes de duel sans pénalité. La main faible réalise une attaque gratuite supplémentaire par tour." },
      { name: 'Maîtrise de l\'escrime', description: "Maîtrise parfaite de l'escrime. Applique le bonus de DEF d'une main gauche à ses attaques." },
    ],
  },
  {
    id: 'voie-de-la-fourberie',
    name: 'Voie de la fourberie',
    family: 'aventuriers',
    capacites: [
      { name: 'Doigts agiles', description: "+5 aux tests de DEX pour crocheter, désamorcer, faire les poches et autres actions de précision." },
      { name: 'Détecter les pièges', description: "Test d'INT (difficulté 10, ou 15 pour les pièges magiques) pour détecter et contourner les pièges." },
      { name: 'Croc-en-jambe', description: "Sur un résultat de 17-20 en attaque de contact, fait chuter l'adversaire en plus des DM normaux." },
      { name: 'Attaque paralysante', description: "1 fois/combat, paralyse un adversaire de douleur pendant 1d4 tours (aucun DM infligé)." },
      { name: 'Attaque en traître', description: "1 fois/tour, obtient une attaque gratuite quand un allié blesse une créature à portée de contact." },
    ],
  },

  // ── MYSTIQUES ────────────────────────────────────────────────────────────
  {
    id: 'voie-de-lalchimie',
    name: 'Voie de l\'alchimie',
    family: 'mystiques',
    capacites: [
      { name: 'Fortifiant', description: "Breuvage qui guérit [1d4+rang] PV et accorde +3 aux [rang+1] prochains tests (dans les 12h)." },
      { name: 'Feu grégeois', description: "Lance une fiole (portée 10m, réussite automatique) qui explose dans un rayon de 3m : 1d6 DM/rang." },
      { name: 'Huile instable', description: "Applique sur une arme (action limitée) : +1d6 DM de feu pendant [5+Mod.INT] minutes." },
      { name: 'Élixir de guérison', description: "Prépare un élixir qui soigne [3d6+Mod.INT] PV, un empoisonnement ou une hémorragie." },
      { name: 'Élixirs de protection', description: "Prépare des potions de Peau d'écorce, Image décalée ou Protection contre les éléments." },
    ],
  },
  {
    id: 'voie-des-arts-druidiques',
    name: 'Voie des arts druidiques',
    family: 'mystiques',
    capacites: [
      { name: 'Langage des animaux', description: "Communique avec les animaux (communication primitive). +5 aux tests pour influencer un animal." },
      { name: 'Nuée d\'insectes', description: "Test d'attaque magique (portée 20m) : 1 DM/tour et -2 aux tests de la cible pendant [5+Mod.SAG] tours." },
      { name: 'Le guetteur', description: "Reçoit un oiseau de proie compagnon. Lien télépathique, peut percevoir par ses sens avec +5 en perception." },
      { name: 'Masque du prédateur', description: "Prend les traits d'un fauve : Mod. INT en initiative, attaque et DM. Vision nocturne pendant [5+Mod.SAG] tours." },
      { name: 'Sagesse héroïque', description: "+2 en SAG. Lance 2d20 à tous les tests de SAG et garde le meilleur." },
    ],
  },
  {
    id: 'voie-de-la-divination',
    name: 'Voie de la divination',
    family: 'mystiques',
    capacites: [
      { name: 'Sixième sens', description: "N'est jamais surpris. +2 en initiative et en DEF." },
      { name: 'Détection de l\'invisible', description: "Pendant [5+Mod.SAG] tours, détecte les créatures invisibles et les sorts de Clairvoyance dans 30m." },
      { name: 'Clairvoyance', description: "Voit et entend à distance dans un lieu connu tant qu'il se concentre (action limitée à chaque tour)." },
      { name: 'Prescience', description: "1 fois/combat, en fin de tour, annule tout ce qui s'est passé et rejoue le tour depuis le début." },
      { name: 'Hyperconscience', description: "+2 en SAG et +2 en INT. Lance 2d20 à tous les tests de SAG ou INT et garde le meilleur." },
    ],
  },
  {
    id: 'voie-de-lenvoutement',
    name: 'Voie de l\'envoûtement',
    family: 'mystiques',
    capacites: [
      { name: 'Injonction', description: "Test d'attaque magique opposé : la cible doit exécuter un ordre simple et non dangereux pour elle." },
      { name: 'Sommeil', description: "[1d6+Mod.INT] cibles dans une zone de 10m (portée 20m) s'endorment pendant [5+Mod.SAG] minutes." },
      { name: 'Confusion', description: "Test d'attaque magique opposé (portée 20m) : la cible agit aléatoirement pendant [3+Mod.SAG] tours (1-3 : n'agit pas, 4-6 : attaque le plus proche)." },
      { name: 'Amitié', description: "Test d'attaque magique (portée 10m) : la cible humanoïde se comporte comme un ami tant qu'elle n'est pas attaquée." },
      { name: 'Domination', description: "Test d'attaque magique opposé (portée 20m) : prend le contrôle total de la cible." },
    ],
  },
  {
    id: 'voie-des-forets',
    name: 'Voie des forêts',
    family: 'mystiques',
    capacites: [
      { name: 'Peau d\'écorce', description: "La peau se transforme en écorce : +2 DEF pendant [5+Mod.SAG] tours (passe à +4 au rang 4)." },
      { name: 'Prison végétale', description: "La végétation entrave les ennemis dans une zone de 10m (portée 20m) pendant [5+Mod.SAG] tours : -2 en attaque et DEF." },
      { name: 'Baies magiques', description: "Fait pousser [1d6+Mod.INT] fruits guérissant chacun [1d10+niveau] PV à celui qui les consomme." },
      { name: 'Animation d\'un arbre', description: "1 fois/combat, anime un arbre qui combat pendant [niveau] tours." },
      { name: 'Régénération', description: "La cible touchée récupère 3 PV par tour pendant [niveau+Mod.SAG] tours (1 fois/jour par cible)." },
    ],
  },
  {
    id: 'voie-des-illusions',
    name: 'Voie des illusions',
    family: 'mystiques',
    capacites: [
      { name: 'Image décalée', description: "Pendant [5+Mod.SAG] tours, sur un toucher, lance 1d6 : sur 5-6, n'encaisse pas les DM." },
      { name: 'Mirage', description: "Crée une illusion visuelle et sonore immobile (durée [5+Mod.SAG] min, volume 10m²/rang, portée 500m)." },
      { name: 'Imitation', description: "Prend l'apparence d'une créature de taille proche (±50cm) vue au moment de l'incantation, pendant [5+Mod.SAG] min." },
      { name: 'Dédoublement', description: "Crée un double translucide d'une cible (portée 20m) sous son contrôle. Le double a les mêmes carac. mais la moitié des PV." },
      { name: 'Tueur fantasmagorique', description: "Test d'attaque magique opposé (portée 20m) : invoque les pires terreurs de la cible, peut la tuer si elle échoue." },
    ],
  },
  {
    id: 'voie-de-la-magie-elementaliste',
    name: 'Voie de la magie élémentaliste',
    family: 'mystiques',
    capacites: [
      { name: 'Brumes', description: "Crée un brouillard dense (portée 20m, zone 20m de diamètre) réduisant fortement la visibilité." },
      { name: 'Sous tension', description: "Charge électrique pendant [5+Mod.SAG] tours : 1d6 DM à quiconque le touche au contact." },
      { name: 'Armure de terre', description: "Pendant [5+Mod.SAG] tours, réduit tous les DM élémentaires (feu, froid, électricité, acide) de 2×rang." },
      { name: 'Boule de feu', description: "Portée 30m, zone 6m de rayon : test d'attaque magique contre chaque cible dans la zone pour [2d6+Mod.INT] DM." },
      { name: 'Intelligence héroïque', description: "+2 en INT. Lance 2d20 à tous les tests d'INT et garde le meilleur." },
    ],
  },
  {
    id: 'voie-de-la-magie-runique',
    name: 'Voie de la magie runique',
    family: 'mystiques',
    capacites: [
      { name: 'Forgeron', description: "+5 en orfèvrerie et forge. En action de mouvement, enflamme son arme : +1 DM de feu/rang pendant [5+Mod.SAG] tours." },
      { name: 'Rune d\'énergie', description: "Rituel de 5 min : enchante un bijou pour 24h. Permet de relancer un d20 1 fois/combat." },
      { name: 'Rune de puissance', description: "Rituel de 5 min : enchante une arme pour 24h. Les DM sont au maximum 1 fois/combat." },
      { name: 'Rune de garde', description: "Inscrit une rune et piège une zone (2-10m de diamètre). Toute créature qui entre déclenche un effet choisi." },
      { name: 'Rune de tradition', description: "Enchante des objets : crée une arme ou armure magique de niveau [arrondi(niveau/3)] au maximum." },
    ],
  },
  {
    id: 'voie-du-mysticisme',
    name: 'Voie du mysticisme',
    family: 'mystiques',
    capacites: [
      { name: 'Bénédiction', description: "Chant d'encouragement : le PJ et ses alliés en vue gagnent +1 à tous leurs tests de Carac. et d'attaque pendant [3+Mod.SAG] tours." },
      { name: 'Protection contre le mal', description: "+2 DEF et aux tests de résistance contre les morts-vivants, les démons et les créatures élémentaires (durée : 1 combat)." },
      { name: 'Délivrance', description: "En touchant la cible, annule les effets de sorts, malédictions, pétrification et capacités spéciales." },
      { name: 'Sanctuaire', description: "Les adversaires doivent réussir un test de SAG (difficulté 15) pour attaquer le PJ pendant [5+Mod.SAG] tours." },
      { name: 'Rituel de puissance', description: "Utilise 1d12 en attaque magique au lieu du d20. Si réussie, ajoute +2d6 DM." },
    ],
  },
  {
    id: 'voie-des-sombres-savoirs',
    name: 'Voie des sombres savoirs',
    family: 'mystiques',
    capacites: [
      { name: 'Saignements', description: "Test d'attaque magique (portée 10m) : 1d6 DM/tour pendant [rang] tours, ignore la réduction de dégâts." },
      { name: 'Malédiction', description: "Test d'attaque magique (portée 20m) : la cible lance 2d20 à tous ses tests et garde le résultat le plus faible." },
      { name: 'Pacte sanglant', description: "Action gratuite : sacrifie 1d4 PV pour obtenir +3 sur un jet de d20 ou en DEF contre une attaque." },
      { name: 'Hémorragie', description: "Test d'attaque magique (portée 10m) : +1d6 DM sur toutes les attaques sanglantes reçues par la cible pendant [5+Mod.SAG] tours." },
      { name: 'Invocation d\'un démon', description: "1 fois/combat, sacrifie 1d6 PV pour invoquer un démon sous ses ordres pendant [5+Mod.SAG] tours." },
    ],
  },

  // ── PRESTIGE ─────────────────────────────────────────────────────────────
  {
    id: 'voie-des-armes-lourdes',
    name: 'Voie des armes lourdes',
    family: 'prestige',
    capacites: [
      { name: 'Allonge', description: "+1 en attaque et +5 en initiative avec une arme à deux mains." },
      { name: 'Frappe massive', description: "Attaque limitée : +1d6 DM supplémentaires. La cible doit réussir un test opposé de FOR ou être renversée." },
      { name: 'Tenir à distance', description: "Attaque et utilise son allonge ce tour : +5 DEF contre les attaques de contact." },
      { name: 'Attaque à outrance', description: "Choisit -2 DEF pour +1d6 DM, ou -5 DEF pour +2d6 DM." },
      { name: 'Critique destructeur', description: "Critique avec une arme à deux mains : +2d6 DM supplémentaires en plus des effets normaux du critique." },
    ],
  },
  {
    id: 'voie-de-la-danse-de-guerre',
    name: 'Voie de la danse de guerre',
    family: 'prestige',
    capacites: [
      { name: 'Pirouette', description: "+2 en DEF grâce à des pas de danse insaisissables. +5 aux tests de danse et d'acrobatie." },
      { name: 'Vent des lames', description: "Peut utiliser le Mod. de DEX au lieu du Mod. de FOR en attaque ou aux DM (arme de guerre ou d'hast)." },
      { name: 'Attaque en mouvement', description: "À chaque action limitée, peut se déplacer de 10m avant ou après." },
      { name: 'Danse de lames', description: "Entre en transe : +2 en attaque et DEF, attaque gratuite supplémentaire par tour (d12 en attaque)." },
      { name: 'Volte-face', description: "Si le PJ attaque une cible différente du tour précédent : +2 en attaque et +1d6 DM." },
    ],
  },
  {
    id: 'voie-du-dogme-de-pierre',
    name: 'Voie du dogme de pierre',
    family: 'prestige',
    capacites: [
      { name: 'Indéracinable', description: "Impossible d'être renversé ou projeté contre sa volonté. +1 en DEF (passe à +2 au rang 3)." },
      { name: 'Sens de la pierre', description: "Perçoit toutes les créatures en contact avec la pierre dans un rayon de 20m, même dans le noir." },
      { name: 'Frappe de la pierre', description: "Un résultat de 1 sur un dé de DM au contact est remplacé par le maximum du dé utilisé." },
      { name: 'Attaque pétrifiante', description: "Test d'attaque à mains nues : si réussi, la cible doit passer un test de CON ou être pétrifiée 1d6 minutes." },
      { name: 'Corps de pierre', description: "Corps en pierre pendant [1d6+Mod.SAG] tours : -5 aux DM subis. Les attaquants au contact reçoivent 1 DM." },
    ],
  },
  {
    id: 'voie-de-lordre-aile',
    name: 'Voie de l\'ordre ailé',
    family: 'prestige',
    capacites: [
      { name: 'Ordre de chevalerie', description: "Rejoint un ordre ailé, reçoit une monture volante, une arme marquée et le rang 5 de la voie du combat monté." },
      { name: 'Arme élémentaire', description: "Nimbe son arme d'une aura élémentaire pendant [5+Mod.SAG] tours : +1d6 DM élémentaires." },
      { name: 'Résistance élémentaire', description: "Retranche 5 points aux DM de son élément (passe à 10 au rang 5 de la voie)." },
      { name: 'Monture puissante', description: "La monture atteint sa pleine maturité, avec des statistiques offensives et défensives fortement améliorées." },
      { name: 'Souffle élémentaire', description: "La monture gagne un souffle élémentaire (portée 40m) : 4d6 DM à la cible principale, 2d6 aux cibles proches." },
    ],
  },
  {
    id: 'voie-de-la-purification',
    name: 'Voie de la purification',
    family: 'prestige',
    capacites: [
      { name: 'Sentir la corruption', description: "Test de SAG (difficulté 15) pour détecter des pouvoirs paranormaux sur une créature à 30m." },
      { name: 'Combattre la corruption', description: "+1 en attaque et DM contre les morts-vivants, les démons et les animaux corrompus (passe à +2 au rang 4)." },
      { name: 'Chasseur de sorcières', description: "+2 DEF contre les attaques magiques. +2 DM contre les personnages à voies de mystique." },
      { name: 'Frappe préventive', description: "En plus des DM normaux, la cible doit réussir un test d'INT (difficulté 15) ou ne peut utiliser aucun pouvoir magique au prochain tour." },
      { name: 'Résister à la corruption', description: "1 fois/combat, résiste totalement à un effet magique. Immunité aux effets de corruption des morts-vivants et démons." },
    ],
  },
  {
    id: 'voie-de-la-rage-ancestrale',
    name: 'Voie de la rage ancestrale',
    family: 'prestige',
    capacites: [
      { name: 'Fureur au combat', description: "+5 aux tests d'intimidation. Gagne le rang 1 de la voie de la férocité (ou bonus amélioré si déjà obtenu)." },
      { name: 'Furie du Berserker', description: "Gagne le rang 3 de la voie de la férocité (ou Furie améliorée : +3 attaque, +2d6 DM, -6 DEF)." },
      { name: 'Étreinte mortelle', description: "1 fois/combat, attrape un adversaire (même taille ou moins) : test d'attaque réussi → [2d6+Mod.FOR] DM." },
      { name: 'Rage froide', description: "Conserve toute sa lucidité en rage : aucune pénalité en DEF, peut utiliser des armes de jet." },
      { name: 'Assaut final', description: "En rage depuis au moins 3 tours : peut doubler les DM d'une attaque, ce qui met fin à la rage." },
    ],
  },
  {
    id: 'voie-du-sang-draconique',
    name: 'Voie du sang draconique',
    family: 'prestige',
    capacites: [
      { name: 'Ascendance draconique', description: "Réduction de 5 points des DM de feu (passe à 10 au rang 4)." },
      { name: 'Férocité', description: "FOR à 18 (ou +2) et griffes naturelles pendant [1d6+Mod.SAG] tours : [1d6+Mod.FOR] DM." },
      { name: 'Souffle du dragon', description: "1 fois/combat, souffle de feu en cône (5m de portée, 5m de large) : 2d6 DM par rang dans cette voie." },
      { name: 'Armure naturelle', description: "En dessous de la moitié de ses PV : réduction de 5 points sur tous les types de DM reçus." },
      { name: 'Ailes de dragon', description: "1 fois/jour, déploie des ailes de dragon pendant [1d6+Mod.SAG] minutes. Vol : 30m par action de mouvement." },
    ],
  },
  {
    id: 'voie-de-larcherie-arcanique',
    name: 'Voie de l\'archerie arcanique',
    family: 'prestige',
    capacites: [
      { name: 'Flèche magique', description: "Les flèches deviennent magiques. Sur un résultat de 1 aux DM, relance le dé et garde le second résultat." },
      { name: 'Flèche tueuse', description: "Flèche dédiée à une cible nommée (1 jour de préparation) : +3 en attaque, +1d6 DM par rang dans cette voie." },
      { name: 'Flèche animiste', description: "1 fois/combat, projette à portée d'arc une Prison végétale avancée sans dépenser de PM." },
      { name: 'Flèche vivante', description: "Sur un résultat de 15-20 en attaque, la flèche inflige +2d6 DM supplémentaires et prend racine dans la victime." },
      { name: 'Flèche intangible', description: "La flèche ignore les obstacles physiques et la couverture. La difficulté est basée sur la DEX de la cible." },
    ],
  },
  {
    id: 'voie-de-laudace',
    name: 'Voie de l\'audace',
    family: 'prestige',
    capacites: [
      { name: 'L\'amour du risque', description: "En situation dangereuse : +3 aux tests d'attaque, de caractéristique et de résistance à la peur." },
      { name: 'Mouche du coche', description: "Sacrifie 1 ou 2 actions de mouvement pour gagner respectivement +3 ou +6 en DEF jusqu'au prochain tour." },
      { name: 'Ça passe ou ça casse', description: "Quand un test peut avoir une issue fatale : lance un d20 supplémentaire et garde le meilleur résultat." },
      { name: 'Poussée d\'adrénaline', description: "Dépense 1d4 PV pour gagner une action de mouvement supplémentaire ce tour." },
      { name: 'Attaque kamikaze', description: "Se jette sur sa cible via un test de DEX : DM bonus selon la taille de la cible, -5 DEF pendant 1 tour." },
    ],
  },
  {
    id: 'voie-du-duel',
    name: 'Voie du duel',
    family: 'prestige',
    capacites: [
      { name: 'Vives lames', description: "+5 aux tests de DEX sur supports mobiles (bateaux, cordages, ponts) et +5 en natation et navigation." },
      { name: 'Défi', description: "1 fois/combat, défie une cible (portée 30m) : +2 en attaque et DEF contre elle pour tout le reste du combat." },
      { name: 'Juste toi et moi', description: "Quand il attaque la cible défiée : +1 DEF/rang dans cette voie contre tous les autres adversaires." },
      { name: 'Parade', description: "1 fois/tour, peut parer une attaque de l'adversaire défié en réussissant un test d'attaque opposé." },
      { name: 'Duel mental', description: "1 fois/tour, test opposé d'INT au contact : en cas de victoire, peut relancer un dé d'attaque ou de DM." },
    ],
  },
  {
    id: 'voie-de-la-flibusterie',
    name: 'Voie de la flibusterie',
    family: 'prestige',
    capacites: [
      { name: 'Équilibriste', description: "+5 aux tests de DEX sur tous les supports mobiles (bateaux, cordages, ponts) et +5 en natation/navigation." },
      { name: 'Coup de crosse', description: "1 fois/tour, attaque gratuite avec la crosse d'une arbalète déchargée (d12 en attaque, [1d4+Mod.FOR] DM)." },
      { name: 'À l\'abordage !', description: "Première attaque de contact d'un combat : +5 en attaque et +2d6 DM." },
      { name: 'Sabre au poing', description: "Peut tirer avec une arbalète de poing d'une main et attaquer au contact avec l'autre sans aucune pénalité." },
      { name: 'Pas de quartier', description: "Attaque gratuite (+5, +1d6 DM) contre toute cible à portée qui tente de s'éloigner." },
    ],
  },
  {
    id: 'voie-de-la-lycanthropie',
    name: 'Voie de la lycanthropie',
    family: 'prestige',
    capacites: [
      { name: 'Forme hybride', description: "Se transforme en forme hybride (mi-humanoïde, mi-loup ou panthère) pendant [5×Mod.SAG] tours : deux attaques naturelles." },
      { name: 'Éventration', description: "Si les deux attaques de la forme hybride touchent : +2d6 DM sur la seconde attaque." },
      { name: 'Forme animale', description: "Prend la forme d'un loup ou d'une panthère (max 1h/niveau/jour). Conserve PV et carac. mentales." },
      { name: 'Odeur du sang', description: "+1 en attaque et DM par tranche de 10 PV perdus par la cible adverse (maximum +5)." },
      { name: 'Fourrure d\'acier', description: "+3 DEF et réduction de dégâts de 3 tant que le PJ est sous forme lycanthrope." },
    ],
  },
  {
    id: 'voie-des-poisons',
    name: 'Voie des poisons',
    family: 'prestige',
    capacites: [
      { name: 'Connaissance du poison', description: "Reconnaît et identifie les poisons sans test. Applique un poison sur une arme sans test d'INT." },
      { name: 'Poison rapide', description: "Avant chaque combat, enduire 3 armes : le premier toucher inflige +2d6 DM. Test de CON (15) pour annuler." },
      { name: 'Poison affaiblissant', description: "Remplace le poison rapide : si la cible rate un test de CON (15), -2 en FOR et DEX." },
      { name: 'Résistance au poison', description: "Quand empoisonné, test de CON (difficulté 10) : succès = aucun effet, échec = effets divisés par 2." },
      { name: 'Poisons virulents', description: "Fabrique poisons lent et violent en petites quantités ([1+Mod.INT] doses/jour). Difficulté de résistance : [12+Mod.INT]." },
    ],
  },
  {
    id: 'voie-des-rituels',
    name: 'Voie des rituels',
    family: 'prestige',
    capacites: [
      { name: 'Rituel au choix', description: "Apprend 1 rituel parmi : Animation des morts, Communion de l'esprit, L'eau des sens, Sanctuaire, Imitation." },
      { name: 'Rituel au choix', description: "Apprend un nouveau rituel de la liste de la voie." },
      { name: 'Rituel au choix', description: "Apprend un nouveau rituel de la liste de la voie." },
      { name: 'Téléportation', description: "Disparaît et réapparaît à moins de [INT×10] mètres. Via un rituel d'1h, peut se téléporter en km." },
      { name: 'Rituel au choix', description: "Apprend un dernier rituel de la liste de la voie." },
    ],
  },
  {
    id: 'voie-des-arcanes',
    name: 'Voie des arcanes',
    family: 'prestige',
    capacites: [
      { name: 'Invisibilité', description: "Devient invisible pendant [1d6+Mod.SAG] minutes. Personne ne peut le détecter. Cesse dès qu'il attaque ou lance un sort." },
      { name: 'Hâte', description: "Pendant [1d6+Mod.SAG] tours : obtient une action supplémentaire par tour (attaque normale ou déplacement)." },
      { name: 'Foudre', description: "Portée 20m : test d'attaque magique pour infliger [6d6+Mod.INT] DM à une cible." },
      { name: 'Téléportation', description: "Se téléporte jusqu'à [INT×10] mètres. Via un rituel d'1h, peut se téléporter jusqu'à [INT×10] km." },
      { name: 'Désintégration', description: "Rayon à portée 20m : test d'attaque magique pour infliger [6d6+Mod.INT] DM. Peut réduire des objets en poussière." },
    ],
  },
  {
    id: 'voie-des-arts-primitifs',
    name: 'Voie des arts primitifs',
    family: 'prestige',
    capacites: [
      { name: 'Gri-gri', description: "Crée un fétiche (sacrifie 1 PV) : accorde +3 à un test choisi, ou permet de relancer un test raté." },
      { name: 'Ombre mortelle', description: "Test d'attaque magique (portée 20m) : l'ombre de la cible l'attaque pendant [3+Mod.SAG] tours." },
      { name: 'Magie du sang', description: "Sacrifie 1d4 PV pour accélérer un sort : action d'attaque → action de mouvement." },
      { name: 'Vents des âmes', description: "Invoque des esprits tourmentés : la cible ne peut effectuer aucune action limitée sans réussir un test pendant [Mod.SAG] tours." },
      { name: 'Mauvais œil', description: "Tant que le PJ regarde sa cible, elle subit une pénalité à tous ses tests chaque tour." },
    ],
  },
  {
    id: 'voie-des-cristaux',
    name: 'Voie des cristaux',
    family: 'prestige',
    capacites: [
      { name: 'Premier cristal', description: "Apprend à créer un cristal de son choix (200 pièces d'argent). Peut bénéficier d'1 cristal à la fois." },
      { name: 'Deuxième cristal', description: "Apprend un nouveau cristal. Peut bénéficier des effets de 2 cristaux simultanément (pas deux fois le même)." },
      { name: 'Troisième cristal', description: "Apprend deux nouveaux cristaux. Peut bénéficier de 3 cristaux simultanément. Changer de cristal = action limitée." },
      { name: 'Quatrième cristal', description: "Apprend deux nouveaux cristaux. Peut bénéficier de 4 cristaux simultanément." },
      { name: 'Cinquième cristal', description: "Apprend deux nouveaux cristaux. Peut bénéficier de 5 cristaux simultanément (max 2 fois le même)." },
    ],
  },
  {
    id: 'voie-des-elements',
    name: 'Voie des éléments',
    family: 'prestige',
    capacites: [
      { name: 'Maîtrise élémentaire I', description: "Maîtrise un premier élément (terre, eau, air ou feu) et gagne ses effets associés." },
      { name: 'Maîtrise élémentaire II', description: "Maîtrise un second élément et gagne ses effets." },
      { name: 'Maîtrise élémentaire III', description: "Maîtrise un troisième élément et gagne ses effets." },
      { name: 'Maîtrise élémentaire IV', description: "Maîtrise le quatrième et dernier élément." },
      { name: 'Forme élémentaire', description: "1 fois/jour par élément maîtrisé : prend une forme élémentaire avec RD, pouvoirs offensifs et défensifs propres." },
    ],
  },
  {
    id: 'voie-de-la-glace',
    name: 'Voie de la glace',
    family: 'prestige',
    capacites: [
      { name: 'Verglas', description: "Recouvre le sol d'une zone de 10m de diamètre : les créatures doivent tester DEX (diff. 12) pour rester debout." },
      { name: 'Cœur de glace', description: "Divise par 2 tous les DM de froid et d'électricité subis pour le reste du combat (ou 10 tours hors combat)." },
      { name: 'Cône de froid', description: "Cône de 20m de portée et 10m de large : [2d6+Mod.INT] DM de froid. Cible ralentie 1 tour si elle rate un test de CON." },
      { name: 'Présence glaciale', description: "+4 DEF, immunité au froid, DM de feu divisés par 2. Les créatures qui le touchent subissent 1d6 DM." },
      { name: 'Tempête de cristal', description: "Portée 40m, rayon 10m autour de la cible : test d'attaque magique contre tous dans la zone." },
    ],
  },
  {
    id: 'voie-de-la-metamorphose',
    name: 'Voie de la métamorphose',
    family: 'prestige',
    capacites: [
      { name: 'Forme animale', description: "Prend la forme d'un animal petit ou moyen. Conserve PV, INT, SAG et CHA, mais acquiert les carac. physiques de la bête." },
      { name: 'Transformation rapide', description: "Reprendre sa forme humanoïde devient une action de mouvement. Peut changer de forme en action de mouvement." },
      { name: 'Grande forme animale', description: "Prend la forme d'un grand animal (ours, tigre, griffon…) : FOR+8, CON+8, DEF 18, attaque +10, DM 2d6+8." },
      { name: 'Transformation régénérative', description: "En reprenant forme humanoïde (action limitée après des blessures en forme animale) : récupère 3d6 PV." },
      { name: 'Forme animale énorme', description: "Prend la forme d'un animal énorme (éléphant, dragon…) : FOR+11, CON+11, DEF 20, attaque +15, DM 3d6+11." },
    ],
  },
  {
    id: 'voie-des-vermines',
    name: 'Voie des vermines',
    family: 'prestige',
    capacites: [
      { name: 'Nuées de criquets', description: "Obtient la capacité Nuées d'insectes (rang 2 des arts druidiques, améliorée : DM et malus augmentés de 1)." },
      { name: 'Compagnon vermine', description: "Adopte un scorpion géant ou une araignée géante comme compagnon permanent." },
      { name: 'Affinité au poison', description: "Peut enduire une arme tranchante du venin du compagnon : 2d6 DM si la cible rate un test de CON (difficulté 12)." },
      { name: 'Vermine supérieure', description: "Le compagnon gagne une capacité spéciale : Étreinte (scorpion) ou Toile (araignée)." },
      { name: 'Maître vermine', description: "Peut communiquer avec toutes les vermines. Celles-ci le considèrent comme une créature amicale." },
    ],
  },
]

export const VOIES_BY_ID: Record<string, Voie> = Object.fromEntries(VOIES.map(v => [v.id, v]))

export const FAMILY_LABELS: Record<VoieFamily, string> = {
  combattants: 'Combattants',
  aventuriers: 'Aventuriers',
  mystiques: 'Mystiques',
  prestige: 'Prestige',
}

export const FAMILY_ORDER: VoieFamily[] = ['combattants', 'aventuriers', 'mystiques', 'prestige']
