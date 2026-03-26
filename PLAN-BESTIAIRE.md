# Plan : Extraction du Bestiaire

## 1. Format des donnees

Chaque monstre a une structure reguliere :
- **Nom**, **description** (texte d'ambiance)
- **Stats** : NC, taille, FOR, DEX, CON, INT, SAG, CHA, DEF, PV, Init., parfois RD
- **Attaque(s)** : nom + bonus + DM (des de degats)
- **Capacites** : liste d'abilities speciales avec description

Certaines pages contiennent plusieurs monstres, certains monstres s'etalent sur 2 pages, et quelques entrees sont des renvois ("Voir Dragon").

## 2. Extraction (script one-shot)

Ecrire un **script Node** dans `scripts/extract-bestiary.ts` qui :
1. Lit chaque PNG en base64
2. L'envoie a l'API Claude (vision) avec un prompt structure demandant un JSON strict par monstre
3. Agrege tous les resultats
4. Genere les deux outputs ci-dessous

**Pourquoi un script ?** 43 images x ~3-5 monstres chacune = ~150+ monstres. Trop volumineux pour faire a la main ou en conversation. Claude vision est le meilleur OCR pour ce format stylise.

## 3. Double output

| Destination | Format | Usage |
|---|---|---|
| `client/src/data/monstersCatalog.ts` | TypeScript (tableau d'objets types) | Code -- le MJ selectionne des monstres pour le combat |
| `knowledge/topics/bestiaire.md` | Markdown structure | IA -- Isilwen peut chercher/lire les fiches de monstres |

**Interface TypeScript** (dans `client/src/types/`) :
```ts
interface Monster {
  name: string
  nc: number
  size: string            // "petite" | "moyenne" | "grande" | "enorme" | "colossale"
  stats: { for: number; dex: number; con: number; int: number; sag: number; cha: number }
  def: number
  pv: number
  init: number
  rd?: number
  attacks: { name: string; bonus: number; damage: string; range?: number }[]
  abilities: { name: string; description: string }[]
  description?: string    // texte d'ambiance
}
```

## 4. Integration IA

- Ajouter `"bestiaire"` a `TOPIC_NAMES` dans `server/src/knowledge/tools.ts`
- Mettre a jour la description du tool pour mentionner le bestiaire
- Le fichier markdown sera auto-charge par `loadTopic("bestiaire")`

## 5. Integration code (combat MJ)

Ceci viendra dans un second temps, mais le catalog sera pret. Le MJ pourra :
- Chercher/filtrer les monstres par nom ou NC
- En ajouter a une session de combat
- Le code utilisera directement `monstersCatalog.ts`

## Sequence de travail

1. **Ecrire le script d'extraction** + le lancer (cout API ~43 appels Claude)
2. **Review** rapide des donnees extraites (spot-check)
3. **Generer** `monstersCatalog.ts` + `bestiaire.md`
4. **Brancher** dans le knowledge system
5. **Supprimer** les PNGs du repo (plus necessaires, et lourds en git)
