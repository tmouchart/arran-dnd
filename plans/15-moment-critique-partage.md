# 14 — Le moment critique partagé (idée 8)

Quand un joueur fait un **20 naturel** ou un **1 naturel**, tous les téléphones de la
campagne réagissent en même temps : flash plein écran, vibration, son.

---

## Décisions prises

1. **Synchro** : le `POST /rolls` part *après* l'atterrissage du dé 3D. Tout le monde flashe ensemble.
2. **Visuel** : halo pulsé sur les bords + nom de l'acteur au centre, 1,2 s.
3. **Son** : synthétisé en Web Audio, zéro fichier.
4. **Portée** : tout le monde, **jets de monstres compris** — sans révéler le jet (voir ci-dessous).

---

## Le tuyau existe presque en entier

- `POST /api/campaigns/:id/rolls` insère le jet puis appelle `broadcastCampaignRoll`
  (`server/src/campaigns/sseStore.ts`) → event SSE `roll` à tous les membres connectés.
- `useCampaignRolls.ts` écoute déjà cet event côté client.
- `rollOutcome()` (`client/src/utils/rollOutcome.ts`) dit déjà si un jet est
  `critical` / `fumble`. Source unique, déjà testée.

Donc la feature = **un composable qui écoute et joue une fanfare** + un petit ajout
serveur pour les jets de monstres.

### Le seul ajout serveur : l'event `critical`

Problème : les jets du MJ sont filtrés (`visibility === 'gm'`) — les joueurs ne
reçoivent jamais le payload. Or on veut que le 20 du dragon fasse vibrer la table.

Solution : dans `broadcastCampaignRoll`, quand un jet filtré est un critique/fumble,
on envoie quand même aux joueurs un **event `critical` allégé** :

```ts
{ outcome: 'critical' | 'fumble', actorName: 'Dragon rouge' }
```

Pas de `die`, pas de `total`, pas de `bonus`. Les joueurs sentent le moment,
ne connaissent pas le chiffre. Le secret du MJ tient.

Le client écoute `critical` **et** `roll` ; les deux appellent `celebrate()`.

---

## Architecture client

### Nouveau : `client/src/composables/useCriticalMoment.ts`

Singleton (état module, comme `useDice3D`). API :

```ts
const { celebrate, enabled } = useCriticalMoment()
celebrate({ outcome: 'critical' | 'fumble', actorName: string, context?: string })
```

Ce qu'il fait :
1. Pose un état réactif `activeMoment` lu par l'overlay.
2. Déclenche `navigator.vibrate([...])` (garde `if ('vibrate' in navigator)`).
3. Joue le son via un petit module audio (voir plus bas).
4. Se coupe tout seul après ~1,4 s.

Garde-fous :
- respecte `prefers-reduced-motion` → pas de flash, on garde la vibration.
- préférence utilisateur en localStorage `arran-critique` (même patron que `arran-dice-3d`).
- **anti-spam** : un seul moment à la fois, et un cooldown de 2 s. Si deux 20 tombent
  coup sur coup, le second est ignoré (sinon stroboscope).

### Nouveau : `client/src/components/CriticalMomentOverlay.vue`

Monté une seule fois, à côté de `Dice3DOverlay` dans `App.vue`.
- `position: fixed; inset: 0; pointer-events: none` (cas « overlay couvrant son
  parent », autorisé par la règle).
- Une div qui pulse en `--brand` (critique) ou `--danger` (échec) + le nom du perso
  en gros au centre : « THÉOS — COUP CRITIQUE ».
- Animation CSS keyframes uniquement, montée en `v-if`.

### Nouveau : `client/src/utils/sfx.ts`

Un `AudioContext` singleton (celui de `useTtsQueue` est créé par appel, pas
réutilisable). Deux sons synthétisés à la main, **zéro fichier à télécharger** :
- **critique** : arpège montant (3 sinus, 0,45 s) + un coup de cloche.
- **échec** : glissando descendant + bruit sourd filtré passe-bas.

Le premier `celebrate()` reprend le contexte suspendu (règle autoplay des navigateurs) —
comme l'utilisateur a forcément tapé un bouton avant, ça passe.

### Branchements (3 lignes chacun)

| Où | Quoi |
|---|---|
| `useCampaignRolls.ts`, listener `roll` | si `rollOutcome(event)` ≠ null → `celebrate(...)` |
| `Dice3DOverlay.vue`, à l'atterrissage | `celebrate(...)` pour **son propre** jet, synchro avec les étincelles |

**Piège à éviter** : mon propre jet part aussi au serveur et me revient par SSE → double
déclenchement. Solution : `useCampaignRolls` ignore les events dont `userId === moi`
(l'info est déjà dans le payload). Le cooldown de 2 s sert de deuxième filet.

### Synchro : envoyer après l'atterrissage

Aujourd'hui le POST vers `/rolls` part en même temps que l'animation. On le déplace
après `revealAfterDice(...)` dans `ActionsView.vue` et `CombatView.vue`. Tout le monde
flashe à ~100 ms près.

Attention : si les dés 3D sont désactivés (préférence off ou `prefers-reduced-motion`),
`playDiceRoll` est un no-op → l'envoi doit partir immédiatement. `revealAfterDice`
gère déjà ce cas, il suffit d'y accrocher l'envoi plutôt qu'à un `setTimeout`.

---

## Banc d'essai dans le kitchen sink

Dans `client/src/views/ComponentLibraryView.vue` (`/component-library`, dev only),
une nouvelle section **« Moment critique »** avec 4 boutons :

| Bouton | Ce qu'il fait |
|---|---|
| ✨ Critique | `celebrate({ outcome: 'critical', actorName: 'Théos' })` — l'effet seul, sans dé |
| 💀 Échec critique | `celebrate({ outcome: 'fumble', actorName: 'Théos' })` — idem |
| 🎲 Jet forcé : 20 | Lance un vrai d20 3D avec la valeur forcée à 20 → étincelles **puis** l'effet |
| 🎲 Jet forcé : 1 | Lance un vrai d20 3D avec la valeur forcée à 1 → onde rouge **puis** l'effet |

Les deux premiers testent l'overlay et le son isolément (itération rapide sur
l'animation). Les deux suivants testent **toute la chaîne** : `dice()` →
`revealAfterDice()` → atterrissage → `celebrate()`, exactement ce que voit un joueur.

C'est possible sans rien ajouter : `dice(sides, values, kind)` de `useDice3D`
accepte déjà des valeurs imposées → `dice(20, [20], 'attaque')`.

Même section, deux petits réglages pour itérer sans recharger : un toggle son on/off
et un toggle vibration on/off.

---

## Découpage & vérification

1. `utils/sfx.ts` + test unitaire sur l'enveloppe (durée, pas de NaN) → `npm test -w client`
2. `composables/useCriticalMoment.ts` + tests : cooldown, reduced-motion, préférence off
3. `CriticalMomentOverlay.vue` monté dans `App.vue` + **section kitchen sink avec les
   4 boutons** → vérif visuelle sur `/component-library`, sur téléphone
4. Branchement `Dice3DOverlay` → un 20 en solo déclenche tout
5. Branchement `useCampaignRolls` + filtre `userId` → deux navigateurs, un seul flash chacun
6. Serveur : event `critical` allégé dans `sseStore.ts` + test sur le filtrage
   (un joueur reçoit `critical` mais jamais le `total`) → `npm test -w server`
7. Déplacer l'envoi du jet après l'atterrissage (ActionsView, CombatView)
8. Toggle dans les réglages, à côté de celui des dés 3D
9. `playtester` sur mobile

---

## Risques connus

- **Vibration sur iOS** : `navigator.vibrate` n'existe pas sur Safari iOS. Le flash et
  le son marchent, la vibration non. Pas de contournement propre — on l'accepte.
- **Son bloqué au premier jet** : l'AudioContext démarre suspendu. On le reprend au
  premier tap utilisateur (n'importe lequel), pas au premier `celebrate()`.
- **Multi-machines Fly** : `clientsByCampaign` est en mémoire d'un seul process. Si
  l'app scale à 2 machines, les joueurs répartis sur des machines différentes ne se
  voient plus. Déjà vrai aujourd'hui pour le log de jets — pas un nouveau problème.
