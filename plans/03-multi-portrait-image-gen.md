# Plan : Portraits multiples dans la génération d'image

## Problème

Quand l'IA appelle `generate_image` pour illustrer une scène avec plusieurs personnages, seul le portrait du joueur courant est passé au générateur. Les portraits des compagnons récupérés via `get_character` restent dans le contexte de conversation mais ne sont pas transmis à l'appel Gemini de génération d'image.

## Solution

Collecter les IDs de portraits lors des appels `get_character` dans le tour courant, puis les charger tous au moment de `generate_image`.

## Étapes

### 1. Créer un cache d'IDs de portraits par tour

Dans la boucle de tool calls (`server/src/index.ts`), avant le `while`, déclarer un `Map` qui stocke les IDs de portraits récupérés pendant le tour :

```ts
const portraitIds = new Map<string, number>(); // nom → portraitImageId
```

### 2. Alimenter le cache dans `get_character`

Quand `get_character` trouve un personnage avec un portrait (lignes 806-814), stocker l'ID dans le cache :

```ts
if (char.portraitImageId) {
  portraitIds.set(char.name, char.portraitImageId);
}
```

### 3. Ajouter le portrait du joueur courant au cache

Avant la boucle de tool calls, si `character.portraitImageId` existe, l'ajouter directement au cache. On a déjà l'info côté client, pas besoin d'un `get_character`.

```ts
const portraitImageId = character ? (character as Record<string, unknown>).portraitImageId : null;
if (typeof portraitImageId === "number" && portraitImageId > 0) {
  portraitIds.set(characterName, portraitImageId);
}
```

### 4. Refactorer `generate_image` pour utiliser le cache

Remplacer le code actuel (lignes 688-725) qui ne charge qu'un seul portrait par :

1. Récupérer tous les portraits en un seul query : `SELECT ... WHERE id IN (...portraitIds.values())`
2. Construire `imageParts` :
   - Le moodboard (style ref) en premier si dispo
   - Chaque portrait chargé, avec un label texte (ex: "Portrait of Thalia")
   - Le prompt final adapté selon les images présentes :
     - Style + N portraits : "Match the style of the first image. The following images are character portraits for: [noms]. Subject: {prompt}"
     - Portraits seuls : "The attached images are character portraits for: [noms]. Subject: {prompt}"
     - Style seul : prompt actuel (style only)
     - Rien : prompt brut

### 5. Mettre à jour le tool definition (optionnel, pas MVP)

Ajouter un paramètre optionnel `characters` (array de noms) à `generate_image` dans `tools.ts`, pour que l'IA indique quels personnages sont dans la scène. Permettrait de filtrer le cache.

**Verdict** : pas nécessaire au MVP. L'IA appelle déjà `get_character` avant `generate_image` (c'est dans ses instructions). Le cache contiendra naturellement les bons portraits.

## Ce qui ne change pas

- Le flow `get_character` → portrait dans le contexte de conversation reste identique
- Le moodboard (style ref) est toujours chargé au boot
- La structure de la réponse SSE (`image` event) ne change pas

## Risques

- **Taille du payload** : chaque portrait est ~200-400 KB en base64. Avec 4-5 personnages + le moodboard, on envoie ~2 MB à Gemini. C'est dans les limites mais à surveiller.
- **Prompt trop long** : si on liste trop de portraits, Gemini pourrait confondre les personnages. Le label "Portrait of X" devrait aider.
