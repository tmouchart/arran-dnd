# Roadmap — Terres d’Arran (assistant web)

Document de planification pour les évolutions au-delà de l’état actuel (Q&A, fiche personnage en localStorage). Les priorités et le découpage en releases peuvent être ajustés au fil du projet.

## Phase A — Données persistées et comptes utilisateurs

### Base PostgreSQL

- Intégrer **PostgreSQL** au monorepo (schéma versionné, migrations, configuration dev/prod).
- Connexion sécurisée depuis l’API Node ; variables d’environnement pour l’URL et les secrets.

### Authentification et provisioning

- **Connexion** : identifiant / mot de passe **classiques** (pas d’OAuth ni de fournisseur tiers prévu dans cette roadmap).
- **Lien de préremplissage** : possibilité d’ouvrir l’app avec des **valeurs préremplies** via l’URL (ex. nom d’utilisateur ou paramètres convenus), pour que le joueur n’ait qu’à saisir son mot de passe — le lien est **distribué manuellement** par le MJ (WhatsApp, autre canal).
- **Création des comptes** : **aucune** inscription ni création d’utilisateur dans l’interface. Les utilisateurs sont **créés hors ligne** via un **script Node** (opérateur / machine de déploiement), qui insère les enregistrements en base (hash du mot de passe, etc.).

### Modèle utilisateur et personnages

- Table **`user`** avec identifiants et secrets gérés comme ci‑dessus.
- Chaque utilisateur possède **plusieurs personnages** (relation 1–N).
- Un des personnages est marqué comme **personnage actif** : c’est celui utilisé par défaut lorsqu’il **rejoint une session** et lors des échanges avec **Isilwen** (assistant IA), tant qu’aucun autre contexte de personnage n’est imposé par la session.

### Persistance de la fiche

- Faire migrer la fiche (PV/PM, caractéristiques, compétences, attaques, voies, etc.) du **localStorage seul** vers le **modèle serveur** lié aux personnages, en conservant une expérience fluide hors ligne si souhaité (stratégie de sync : ultérieure).

---

## Phase B — Sessions de jeu et rôles

*(Comportement métier ci‑dessous ; la **persistance** des sessions en PostgreSQL pourrait s’ajouter quand la Phase A sera en place — aujourd’hui : mémoire.)*

### Diffusion des mises à jour (SSE)

- Les **changements d’état de la session** (combat, initiative, participants, etc.) doivent être **envoyés aux clients** via **SSE** (*Server-Sent Events*, événements temps réel) : chaque joueur connecté reçoit les mises à jour sans recharger la page ni s’appuyer sur du polling pour l’essentiel de la synchronisation.

### Création et adhésion

- Un utilisateur peut **créer une session** ; il devient le **MJ (GM)** de cette session.
- Les joueurs peuvent **lister les sessions en cours** et **rejoindre** une session (code, lien, ou liste selon le choix produit).

### Combat partagé (vue MJ / joueurs)

- Dans une session, le MJ peut **ajouter des monstres au combat** avec leurs **PV**.
- **Visibilité des PV** :
  - **MJ** : voit les PV des monstres (et gère le combat côté ennemis).
  - **Joueurs** : ne voient **pas** les PV des monstres.
  - **Joueurs** : peuvent voir les **PV des autres joueurs** (personnages des participants), pour le suivi de table.

### Initiative et ordre de tour

- Chaque joueur peut **modifier la valeur d’initiative** de son personnage (dans les limites prévues par les règles / l’UI).
- **Tous** voient l’**ordre de jeu** (personnages + monstres) dérivé de l’initiative, sur un **écran adapté mobile** (responsive, utilisable au téléphone en partie).

---

## Phase C — Interface joueur : onglets Combat et Personnage

Pour chaque participant connecté à une session :

- **Onglet « Combat »**  
  - Affiche le **combat en cours** : ordre d’initiative, état visible selon les règles de visibilité ci-dessus, contexte de la rencontre (selon ce que le MJ partage).

- **Onglet « Personnage »**  
  - Affiche la **fiche du personnage** du joueur : **PV**, **caractéristiques**, **voies de profil**, **attaques** et **compétences** disponibles — aligné sur le modèle Chroniques Oubliées / Terres d’Arran déjà présent dans l’app.

---

## Transversal

- **Isilwen** : lier le contexte chat au **personnage actif** (et éventuellement à la **session** / campagne) pour des réponses plus pertinentes.
- **Sécurité** : autorisation stricte (seul le MJ modifie monstres/PV cachés ; chaque joueur ne modifie que ses données autorisées).
- **Temps réel** : aujourd’hui **SSE** pour pousser les événements aux clients connectés à une session ; WebSocket ou autre n’est pas nécessaire tant que le modèle unidirectionnel suffit.

---

## Hors scope explicite (pour l’instant)

- **Inscription ou création de compte** par les joueurs dans l’app (remplacée par le script Node + liens manuels).
- Parsing automatique du PDF des règles (le corpus reste manuel dans `knowledge/`).
- RAG / embeddings pour la Q&A (hors roadmap courte ci-dessus).

---

*Dernière mise à jour : mars 2026 — à synchroniser avec `docs/PLAN.md` et `AGENTS.md` lorsque des phases sont livrées.*
