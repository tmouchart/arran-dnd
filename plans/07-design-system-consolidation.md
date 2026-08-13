# 07 — Consolidation du design system

## Contexte

L'app a un bon socle de composants partagés (`client/src/components/ui/`) mais 8 200 lignes de CSS scoped dans les vues ont créé de la variance :

- 17 modals/overlays maison (4 vocabulaires concurrents), AppBottomSheet utilisé seulement dans le journal
- 8 implémentations de tabs, aucun composant partagé
- 27 fichiers avec leurs propres classes de bouton, ~180 `<button>` bruts
- 36 `class="input"` bruts (select/textarea sans composant)
- 188 `border-radius` en dur, 0 token de radius ; ~294 hex en dur
- Paddings trop généreux pour un usage quasi exclusif mobile (ex. `note-item` à 16/12px)

Décisions actées :
- **Pas de shadcn/Tailwind pour l'instant** : on consolide les composants existants.
- **Pas de dépendance Reka UI** : AppModal suit le pattern éprouvé d'AppBottomSheet.
- **AppModal ≠ AppBottomSheet** : deux composants distincts, mêmes conventions de props.
- **Densité mobile-first** : l'app se joue sur téléphone, tout doit être compact.

## Étape 1 — Tokens radius + spacing, densité

1. Ajouter dans `client/src/style.css` (`:root`) :
   - `--radius-sm: 8px`, `--radius-md: 10px`, `--radius-lg: 12px`, `--radius-xl: 16px`, `--radius-pill: 999px`
   - `--space-xs: 0.25rem`, `--space-sm: 0.4rem`, `--space-md: 0.6rem`, `--space-lg: 0.85rem`
2. Remplacer les `border-radius` en dur par le token le plus proche (sweep sur tous les `.vue` + css globaux).
3. Passe de densité sur les composants partagés (AppCard, AppButton, AppInput, AppBottomSheet, AppPageLayout) et les patterns de liste les plus visibles (note-item & co) : paddings ramenés vers `--space-sm`/`--space-md`.
→ verify : `npm run build -w client` + tour visuel de l'app (diff quasi nul pour le radius, plus compact pour les listes).

## Étape 2 — AppModal

1. Créer `client/src/components/ui/AppModal.vue` : Teleport body, overlay, boîte centrée, fermeture Échap + clic dehors, props/slots alignés sur AppBottomSheet (`open`, `@close`, `title`, slot défaut, slot `#footer`). Dense par défaut.
2. Migrer les modals maison une par une (le contenu interne ne bouge pas, seul l'échafaudage overlay/box est remplacé) :
   AbilityInitModal, HpGrowthModal, LevelUpModal, VoiePickerModal, AgonieModal,
   CombatView (2 systèmes), ActionsView (2), CampaignView, CampaignListView,
   JournalPageView, ChatView (lightbox), DrawingCanvas (popup → à évaluer).
3. Supprimer le CSS d'overlay de chaque fichier migré ; en profiter pour remplacer les hex qui dupliquent un token et densifier les paddings.
→ verify : ouverture/fermeture de chaque modal dans l'app.

## Étape 3 — AppTabs

1. Créer `client/src/components/ui/AppTabs.vue` : `v-model` + `tabs: { value, label, icon? }[]`, icônes Lucide, style unique dense.
2. Migrer : CharacterSheetView, CampaignView, CampaignCharacterView, CombatView, JournalView (quasi identiques), puis ChatView, LoginView, AbilityInitModal (divergents, rapprochés du style commun).
→ verify : navigation par onglets sur chaque vue.

## Étape 4 — AppSelect + AppTextarea

1. Créer `AppSelect.vue` (wrap `<select>` natif) et `AppTextarea.vue`, API calquée sur AppInput.
2. Remplacer les 36 `class="input"` bruts (19 fichiers).
3. Retirer de CLAUDE.md l'exception « select/textarea utilisent class="input" ».
→ verify : chaque formulaire touché fonctionne (saisie + sauvegarde).

## Étape 5 — Kitchen sink (dev only)

1. Créer `client/src/views/ComponentLibraryView.vue` : montre chaque composant `App*` avec toutes ses variantes/états (+ tokens couleurs, radius, spacing).
2. Route `/component-library` enregistrée uniquement si `import.meta.env.DEV`.
→ verify : page accessible en dev, absente du build de prod.

## Étape 6 — CLAUDE.md

- Règle en tête de section UI : TOUJOURS utiliser les composants partagés ; ne jamais recréer un pattern existant en CSS scoped ; si un pattern récurrent n'a pas de composant, créer un `App*` dans `ui/` d'abord.
- Ajouter AppModal, AppTabs, AppSelect, AppTextarea au catalogue.
- Règle densité : mobile-first, paddings compacts via tokens `--space-*`, radius via `--radius-*`.
- Mentionner la page `/component-library` comme référence vivante.

## État — terminé le 2026-08-13

Les 6 étapes sont faites, `npm run build -w client` et `npm test` passent, vérification visuelle OK
(fiche perso, journal, actions, kitchen sink) sans erreur console.

Résultats mesurés :

| Indicateur | Avant | Après |
|---|---|---|
| Fichiers avec Teleport maison | 13 | 3 (aucun n'est un dialogue) |
| Tab bars maison | 8 | 0 |
| `class="input"` bruts | 36 | 0 |
| `border-radius` en dur | 188 | 6 |
| Lignes de `<style>` scoped | 8 233 | 7 612 |

Composants créés : `AppModal`, `AppTabs`, `AppSelect`, `AppTextarea` + page `/component-library`.

Cas laissés volontairement (spécialisés, pas de la variance) :
- `ChatView` lightbox image — visionneuse plein écran fond noir, pas un dialogue.
- `CombatView` footer sticky — Teleport de layout.
- `MentionTextarea` menu au caret — dropdown positionné, mériterait un `AppMenu` si un 2e cas apparaît.

Régressions visuelles assumées lors de la migration :
- `AgonieModal` perd sa bordure colorée selon le verdict (le bandeau garde l'info).
- `VoiePickerModal` passe de bottom-sheet à dialogue centré.
- `LoginView` / `ChatView` adoptent le style d'onglets commun (c'était le but).
- Footers de modals : boutons alignés à droite avec séparateur, au lieu de centrés.

## Hors scope (plus tard si besoin)

- Grand nettoyage des hex d'ActionsView (61) et refonte de ses 21 classes de bouton.
- Reka UI (focus trap, dropdowns riches).
- Question shadcn/Tailwind : à re-poser une fois les vues assainies.
