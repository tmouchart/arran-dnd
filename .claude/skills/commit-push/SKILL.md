---
name: commit-push
description: Commit only the changes made in the current session (multi-agent safe), grouped by feature, then push
allowed_tools: Bash, Read, Glob, Grep, Write
---

Commit **only your own work** — the changes you made in this session — then push.

Plusieurs agents travaillent en parallèle sur ce repo. Le working tree contient donc
des changements qui ne sont pas les tiens. Ne commit jamais le travail d'un autre agent.

## 0. Établir la liste de TES fichiers

Avant tout, écris la liste des fichiers que **tu** as créés ou modifiés pendant cette
session. Source de vérité : tes propres appels Write / Edit / NotebookEdit dans cette
conversation. Rien d'autre.

- Ne te sers pas de `git status` pour décider quoi commit — seulement pour voir l'état.
- Un fichier modifié que tu ne retrouves pas dans tes propres éditions → il n'est pas à toi, tu l'ignores.
- Si tu n'as touché aucun fichier, dis-le et arrête. Ne commit rien.
- `package-lock.json` / lockfiles : ne les commit que si c'est toi qui as lancé l'install.

## 1. Regarder l'état

Lance en parallèle :

```
git status
git diff -- <tes fichiers>
```

Compare `git diff` avec ce que tu as écrit. Si un fichier à toi contient aussi des
modifications que tu ne reconnais pas → un autre agent a touché le même fichier.
Passe à l'étape 2b pour ce fichier.

`git log --oneline -5` pour retrouver le style de messages du repo.

## 2. Stager

### 2a. Fichier que toi seul as touché

```
git add <fichier>
```

### 2b. Fichier partagé avec un autre agent — stage seulement tes lignes

N'utilise **jamais** `git add -p` ni `git add -i` (interactif, interdit ici).
Fabrique un patch qui ne contient que tes hunks, et applique-le à l'index :

```bash
git diff -- <fichier> > <scratchpad>/full.patch
```

1. Lis `full.patch`.
2. Écris `<scratchpad>/mine.patch` : garde l'en-tête (`diff --git`, `index`, `---`, `+++`)
   et **uniquement les hunks correspondant à tes modifications**. Supprime les autres hunks
   entièrement (du `@@` jusqu'au `@@` suivant).
3. Applique :

```bash
git apply --cached <scratchpad>/mine.patch
```

Si `git apply` râle sur les compteurs de lignes des `@@`, ajoute `--recount`.

4. Vérifie avant de commit :

```bash
git diff --cached -- <fichier>
```

Ce diff ne doit contenir QUE tes lignes. Si ce n'est pas le cas, `git reset <fichier>`
et recommence.

Si un hunk mélange tes lignes et celles d'un autre agent de façon inséparable, ne devine
pas : laisse le fichier de côté et signale-le à l'utilisateur à la fin.

## 3. Commits groupés

Groupe tes changements par feature. Un commit par groupe, jamais de mélange de
préoccupations indépendantes.

Pour chaque groupe :
- Stage les fichiers du groupe (étape 2).
- Message de commit :
  - sujet impératif, ≤72 caractères, style du repo (conventional commits)
  - explique le *pourquoi*
- Commit via HEREDOC pour préserver le formatage.

## 4. Build et tests

```
npm run build
npm test
```

Attention : build et tests tournent sur **tout** le working tree, y compris le travail
en cours des autres agents. Une erreur peut ne pas venir de toi.

- Erreur causée par ton code → corrige et fais un commit fixup.
- Erreur causée par le code d'un autre agent → ne corrige pas, ne commit pas sa correction.
  Signale-le et continue.

## 5. Push

`git push` une fois tes commits faits.

## 6. Rapport final

Donne :
- la liste des SHAs créés,
- les fichiers laissés de côté (pas à toi, ou hunks inséparables),
- les erreurs build/test attribuées à un autre agent, s'il y en a.
