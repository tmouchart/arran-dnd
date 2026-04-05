# Plan: TTS progressif phrase par phrase

## Contexte

Le TTS actuel envoie le texte complet en un seul appel Gemini TTS, ce qui crée une latence importante. L'utilisateur doit attendre la synthèse entière avant d'entendre quoi que ce soit. L'idée : découper le texte en phrases, envoyer la première immédiatement, pré-fetcher les suivantes pendant la lecture, et enchaîner le tout sans coupure audible.

## Architecture

### Nouveaux fichiers
- `client/src/utils/splitSentences.ts` — Découpage du texte en phrases
- `client/src/composables/useTtsQueue.ts` — Pipeline TTS progressif avec Web Audio API

### Fichiers modifiés
- `client/src/api/tts.ts` — Ajouter `fetchTtsBuffer()` avec `AbortSignal`
- `client/src/views/ChatView.vue` — Remplacer le TTS inline par le composable

### Serveur
Aucune modification. L'endpoint `POST /api/tts` est appelé plusieurs fois avec des textes plus courts.

---

## 1. Découpage en phrases (`splitSentences.ts`)

Fonction pure qui split du texte français en phrases :
- Split sur `[.!?…]` suivi d'espace + majuscule
- Protection des abréviations courantes (M., Mme., Dr., etc., cf.)
- Fusion des segments trop courts (< 20 chars) avec le suivant
- Tests unitaires pour les cas limites français

## 2. Fetch TTS avec AbortSignal (`tts.ts`)

Ajouter `fetchTtsBuffer(text, signal?) → ArrayBuffer` :
- Retourne un `ArrayBuffer` (pas blob URL) pour `decodeAudioData`
- Support `AbortSignal` pour annuler les requêtes en vol
- L'ancien `fetchTts()` peut être supprimé si tous les appelants migrent

## 3. Composable `useTtsQueue`

### API exposée
```ts
{
  play(text: string, index: number): void    // Lecture manuelle
  stop(): void                                // Arrêt immédiat
  playingIndex: Ref<number | null>
  ttsLoadingIndex: Ref<number | null>
  // Auto-play pendant le streaming :
  feedDelta(chunk: string): void              // Nourrir avec les deltas SSE
  startAutoPlay(index: number): void          // Activer le mode streaming
  flushAutoPlay(): void                       // Fin du stream, envoyer le reste
}
```

### Lecture gapless avec Web Audio API
- Un `AudioContext` unique, créé au premier `play()` (nécessite interaction utilisateur)
- Chaque phrase → `fetchTtsBuffer()` → `decodeAudioData()` → `AudioBuffer`
- Scheduling précis : `sourceNode.start(nextStartTime)` où `nextStartTime = prevStart + prevDuration`
- Si un buffer arrive en retard (nextStartTime déjà passé), lecture immédiate (micro-gap acceptable vs overlap)

### Pré-fetch
- Fetch la phrase 1 immédiatement
- Dès qu'elle revient : lecture + lancer phrases 2 et 3 en parallèle
- Concurrence max de 3 requêtes simultanées
- Compteur de génération pour ignorer les callbacks d'une session annulée

### Stop
- Abort tous les fetch en vol (un `AbortController` par segment)
- `sourceNode.stop()` + disconnect sur tous les noeuds schedulés
- Reset du state

### Erreur par segment
- Si une phrase échoue → skip, continuer avec la suivante
- Si la phrase 0 échoue → clear le loading, ne pas bloquer l'UI

## 4. Auto-play pendant le streaming SSE

C'est le gain de latence majeur. Au lieu d'attendre la fin du stream :

1. Quand `autoVoice` est on et que le stream commence → `ttsQueue.startAutoPlay(index)`
2. Dans le callback `onDelta` → `ttsQueue.feedDelta(chunk)` accumule le texte
3. Dès qu'une phrase complète est détectée dans le buffer → fetch TTS immédiat
4. Quand le stream finit → `ttsQueue.flushAutoPlay()` envoie le texte restant

Résultat : la première phrase est déjà en train de se faire synthétiser pendant que le reste du message stream encore.

## 5. Intégration dans ChatView.vue

**Supprimer** : `ttsLoadingIndex`, `currentAudio`, `currentAudioUrl`, `playingIndex`, `stopCurrentAudio()`, `playTts()` inline.

**Ajouter** :
```ts
const ttsQueue = useTtsQueue()
const { playingIndex, ttsLoadingIndex } = ttsQueue
```

**Dans `submit()`** :
- Avant `streamChat()` : si `autoVoice.value`, appeler `ttsQueue.startAutoPlay(nextIndex)`
- Dans `onDelta` : appeler `ttsQueue.feedDelta(chunk)` si auto-play actif
- Remplacer le bloc auto-play post-stream (lignes ~197-202) par `ttsQueue.flushAutoPlay()`

**Template** : inchangé (utilise déjà `playingIndex`, `ttsLoadingIndex`).

## 6. Ordre d'implémentation

1. `splitSentences.ts` + tests
2. `fetchTtsBuffer()` dans `tts.ts`
3. `useTtsQueue.ts` (le coeur)
4. Intégration dans `ChatView.vue`
5. Test manuel : auto-play + play individuel + stop mid-playback

## Points d'attention

- **AudioContext resume** : les navigateurs bloquent l'audio sans interaction. Créer le contexte au premier clic (play ou toggle autoVoice)
- **Race conditions** : compteur de génération pour invalider les sessions obsolètes
- **Mémoire** : disconnect les sourceNodes terminés, laisser le GC récupérer les AudioBuffers
