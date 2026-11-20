# 30 — Voies de prestige et passifs automatiques

Le groupe est niveau 7. Au niveau 8, les voies de prestige s'ouvrent.
Audit fait le 2026-11-20 contre le PDF du livre (`knowledge/livre_joueur.pdf`).

## Ce que dit le livre (p. 52 et 118)

- Accès à partir du niveau 8.
- **Chaque rang de prestige coûte 2 points**, rangs 1 et 2 compris.
- Chaque voie de prestige appartient à une famille : 7 combattants, 7 aventuriers, 7 mystiques.
- « La famille avant tout » : les voies de la famille du profil ne doivent jamais devenir minoritaires.
- Un sort (*) coûte son rang en PM. Pas de magie économe sur un sort de prestige.
- Option non codée ici : prendre une voie de profil comme voie de prestige (même coût).

## Lot 1 — Règles de prestige

1. `Voie.family` = la vraie famille du livre. `Voie.prestige: true` marque les 21 voies.
   La pseudo-famille `'prestige'` disparaît. → verify : `vue-tsc` sans erreur.
2. Coût : `utils/voiePoints.ts` (2 pts par rang de prestige). → verify : tests unitaires.
3. Une voie de prestige ne compte pas dans la famille du profil. → verify : test `inferProfileFamily`.
4. Règle de famille : `utils/prestigeRules.ts`. On compte les **voies** par famille.
   La famille du profil doit en garder au moins autant que chaque autre famille.
   Le sélecteur verrouille les voies qui casseraient la règle. → verify : tests.
5. Drapeau `spell` sur chaque capacité marquée * dans le livre (profil + prestige).
   Les PM se calculent sur ce drapeau, plus sur la famille mystique.
   Forme élémentaire : `spellRank: 4`. → verify : test + bouton « Lancer le sort » sur Foudre.
6. Aperçu dès le niveau 7 : un bouton ✨ ouvre les voies de prestige en lecture seule.
   Toute voie verrouillée (niveau ou règle de famille) se déplie pour lire ses 5 capacités.

## Lot 2 — Textes justes

1. Corriger `client/src/data/voies.ts` (prestige) avec l'audit : Vives lames, Foudre, rituels,
   éléments, poisons, Odeur du sang, Gri-gri, Verglas, Affinité au poison, Corps de pierre…
2. Réécrire `knowledge/topics/voies-de-prestige.md` en entier depuis le PDF (familles, intros,
   rituels, cristaux, éléments) + règles dans `creation-personnage.md`.
   Puis `node scripts/sync-plugin-rules.mjs`. → verify : `pluginSync.test.ts` passe.

## Lot 3 — Passifs automatiques (quick wins)

Nouveaux effets de capacité, appliqués par `pathEffects()` :

1. `def`, `init`, `hp` : bonus fixe ou Mod. d'une carac, avec `fromRank` pour les bonus
   qui grandissent avec la voie (Robustesse, Indéracinable).
   Affichés avec leur source sur la fiche. L'initiative calculée est envoyée au serveur
   (colonne `initiative`) pour l'ordre des combats.
2. `rd` : réduction des dégâts, affichée sur la fiche (Grimm RD 3, Macalan RD 1).
3. `test` : +X fixe à tous les tests d'une carac (Résistance naine +5 CON…), ajouté au jet.
4. Combat à deux armes parfait : l'action passe en action d'attaque au rang 5.
5. Arme de prédilection : une case sur l'arme. +1 attaque, puis +2 DM (Spécialisation).
   Sens affûtés : Mod. SAG aux DM avec un arc.
6. Science du critique : critique sur 19-20 (18-20 à la rapière).

Bug corrigé au passage : à la création, `initiativeBonus` prenait la valeur de la DEX.

## Après déploiement — données prod

Les joueurs ont tapé ces bonus à la main. Une fois calculés, ils compteraient double.
À remettre à zéro (avec l'accord du MJ) :

| Perso | Champ | Avant | Après | Pourquoi |
|---|---|---|---|---|
| Drah'Zul (13) | `defense_bonus` | 4 | 0 | Armure naturelle + Sixième sens, calculés |
| Drah'Zul (13) | `initiative_bonus` | 2 | 0 | Sixième sens, calculé |
| Drah'Zul (13) | `hp_bonus` | 5 | 0 | Robustesse + Force de la nature, calculés |
| Grimm (8) | `defense_bonus` | 2 | 0 | Peau de pierre, calculée |
| Hyl'Ogas (15) | `defense_bonus` | 3 | 0 | Grâce féline, calculée (+4, pas +3) |
| Hyl'Ogas (15) | `initiative_bonus` | 3 | 0 | Grâce féline, calculée (+4) |
| Thrazik (14) | `initiative_bonus` | 19 | 0 | bug de création (= DEX) |
| Macalan (17) | `initiative_bonus` | 10 | 0 | bug de création (= DEX) |
| Polo (20) | `initiative_bonus` | 10 | 0 | bug de création (DEX par défaut) |

Thrazik : `attack_distance_bonus` = 1, sans doute l'arme de prédilection tapée à la main.
Une fois l'arc coché « de prédilection », le remettre à 0.

## Hors périmètre

- Noter les choix (rituels, cristaux, éléments, monture, forme du lycanthrope).
- Voie de profil prise comme voie de prestige.
- Appliquer la RD automatiquement quand le MJ inflige des dégâts.
