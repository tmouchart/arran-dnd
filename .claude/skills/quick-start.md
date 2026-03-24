---
name: quick-start
description: Guide a new user (including non-developers) through installing and running arran-dnd locally on Windows
triggers:
  - initialiser le projet
  - démarrer le projet
  - commencer le projet
  - installer le projet
  - quick start
  - comment lancer
  - comment démarrer
allowed_tools: Bash, Read, Glob, Grep
---

Guide l'utilisateur pas à pas pour installer et lancer le projet sur Windows. Explique chaque étape clairement, comme si la personne n'avait jamais touché à du code. Vérifie chaque prérequis avant de passer à l'étape suivante.

---

## Avant de commencer — Installations requises (Windows uniquement)

Ces logiciels sont nécessaires. Si tu ne les as pas encore, installe-les dans l'ordre en cliquant sur les liens ci-dessous et en suivant les instructions à l'écran.

### 1. Node.js (le moteur qui fait tourner le projet)

Rends-toi sur le site officiel de Node.js et télécharge la version **LTS** (Long Term Support) :
👉 https://nodejs.org

Suis l'installateur jusqu'à la fin, laisse toutes les options par défaut cochées.

### 2. Git Bash (pour taper des commandes)

Rends-toi sur le site officiel de Git :
👉 https://git-scm.com/downloads/win

Télécharge la version Windows et suis l'installateur. Laisse toutes les options par défaut. Git Bash sera le terminal que tu utiliseras pour les commandes.

### 3. Docker Desktop (pour la base de données)

Rends-toi sur le site officiel de Docker :
👉 https://www.docker.com/products/docker-desktop

Télécharge **Docker Desktop for Windows**. Pendant l'installation :
- Quand il te demande de choisir un backend, sélectionne **WSL 2** (et non Hyper-V)
- Une fois l'installation terminée, **redémarre ton ordinateur**

Après le redémarrage, ouvre Docker Desktop et attends que le logo Docker en bas à gauche soit vert (ça peut prendre 1-2 minutes).

---

## Vérification des prérequis

Une fois les trois logiciels installés et l'ordinateur redémarré, ouvre **Git Bash** et vérifie que tout est en place :

```bash
node --version      # doit afficher v20 ou plus
git --version       # doit afficher une version de git
docker --version    # doit afficher une version de docker
```

Si une commande affiche une erreur, retourne à l'étape d'installation correspondante.

---

## Étape 1 — Cloner le projet

Dans Git Bash, navigue là où tu veux mettre le projet (par exemple ton bureau) puis clone le dépôt :

```bash
cd ~/Desktop
git clone <URL_DU_REPO>
cd arran-dnd
```

Remplace `<URL_DU_REPO>` par le lien que tu as reçu.

---

## Étape 2 — Installer les dépendances

Toujours dans Git Bash, depuis le dossier `arran-dnd` :

```bash
npm install
```

Cette commande télécharge tous les composants nécessaires au projet. Ça peut prendre quelques minutes.

---

## Étape 3 — Fichier de configuration (.env)

Le projet a besoin d'un fichier `.env` qui contient des informations sensibles (clés API, mots de passe). Ce fichier n'est pas inclus dans le dépôt pour des raisons de sécurité.

**Demande une copie du fichier `.env` à Thomas**, puis place-le dans le dossier `server/` du projet :

```
arran-dnd/
  server/
    .env   ← colle le fichier ici
```

---

## Étape 4 — Démarrer la base de données

Lance la base de données PostgreSQL avec Docker :

```bash
docker compose up -d
```

Vérifie qu'elle tourne bien :

```bash
docker compose ps
```

Tu dois voir un conteneur avec le statut `running`.

---

## Étape 5 — Lancer le projet

```bash
npm run dev
```

Cette commande démarre tout en même temps : le serveur et l'interface web. Les migrations de base de données sont appliquées automatiquement au démarrage.

Une fois lancé, ouvre ton navigateur et va sur :
👉 http://localhost:5173

---

## Dépannage

| Problème | Solution |
|---|---|
| `node` non reconnu | Réinstalle Node.js et redémarre Git Bash |
| `docker` non reconnu | Assure-toi que Docker Desktop est lancé et redémarre Git Bash |
| Erreur de connexion à la base de données | Lance `docker compose up -d` et attends quelques secondes |
| Page blanche ou erreur réseau | Vérifie que `npm run dev` tourne toujours dans Git Bash |
| Erreur d'API (AI) | Vérifie que le fichier `server/.env` est bien présent et complet |
