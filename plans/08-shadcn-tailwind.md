# 08 — Tailwind + shadcn-vue sous le capot

## Objectif

Faire tourner nos composants `App*` sur **Tailwind v4 + shadcn-vue (reka-ui)**, sans casser
les 62 vues existantes. Look plus **clean et pro**, esprit **RPG chaleureux** conservé.

L'API publique des composants (`<AppButton variant="primary">`) ne change pas.
Seul l'intérieur change. C'est une refonte invisible depuis les vues.

## Ce qu'on gagne / ce qu'on perd

**Gagne**
- Accessibilité gratuite (focus trap, ARIA, clavier) via reka-ui sur Modal / Sheet / Select / Tabs / Toast.
- Espacements et tailles cohérents partout (échelle Tailwind au lieu de rem à la main).
- Variantes propres avec CVA au lieu de `:class="[...]"` bricolés.
- Nouveaux composants faciles à ajouter (`npx shadcn-vue add ...`).

**Perd**
- Une étape de build en plus + des classes longues dans les templates.
- ~1 semaine de migration progressive.

**Important** : shadcn-vue n'est pas une dépendance npm. Il **copie le code** dans notre repo.
On garde donc la main sur tout, et on peut le styler RPG librement.

---

## Décision de style : le "pont" de tokens

C'est le cœur du plan. shadcn attend des variables nommées `--background`, `--foreground`,
`--primary`, `--card`, `--ring`… Nous on a `--bg`, `--text`, `--brand`, `--surface`…

On **ne renomme rien**. On crée un pont : les variables shadcn pointent sur les nôtres.

```css
@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--text);
  --color-card: var(--surface);
  --color-muted: var(--surface-2);
  --color-muted-foreground: var(--muted);
  --color-border: var(--border);
  --color-primary: var(--brand);          /* or medieval */
  --color-secondary: var(--accent);       /* vert parchemin */
  --color-destructive: var(--danger);
  --color-ring: var(--accent);
  --radius: var(--radius-lg);
  --font-sans: 'Crimson Pro', Georgia, serif;   /* on garde le serif ! */
  --font-display: 'Metamorphous', Georgia, serif;
}
```

Conséquences :
- Le dark mode existant (`[data-theme='dark']`) continue de marcher **tel quel**.
- Les 57 fichiers qui utilisent `var(--brand)` en CSS scoped continuent de marcher.
- On peut migrer composant par composant, sans big bang.

### Palette — "or + encre" (décidé)

Le problème actuel : bouton primary or `#c9943e` + texte `#f7f4ef` = contraste **2.1:1**.
C'est sous le seuil lisible (4.5:1). D'où le côté délavé.

On garde l'or comme couleur d'action, mais avec du **texte encre** dessus. Look enseigne
de taverne / lettrage peint. Le fond parchemin ne bouge pas.

**Light**
```css
--brand:          #d9a544;   /* était #c9943e — un cran plus lumineux */
--brand-strong:   #c28f2e;   /* hover / bordure */
--on-brand:       #241c10;   /* NOUVEAU — texte sur fond or → 8.9:1 */
--accent:         #2d8a5e;   /* inchangé */
--danger:         #8f2f2f;   /* était #943232 — légèrement désaturé */
```

**Dark** (`[data-theme='dark']`)
```css
--brand:          #d4a94e;   /* inchangé */
--brand-strong:   #e8c472;   /* inchangé */
--on-brand:       #241c10;   /* même encre — lisible sur or en dark aussi */
```

Changement concret : dans `.btn.primary`, `color: #f7f4ef` → `color: var(--on-brand)`.
Et supprimer le dégradé (`linear-gradient`) au profit d'un aplat `var(--brand)`.
Les aplats font plus propres que les dégradés.

> **Risque assumé** : l'or reste utilisé partout, donc il ne signale rien de particulier.
> Parade sans changer la palette → **un seul bouton primary par écran**. Le reste en `ghost`.
> À vérifier écran par écran pendant l'étape 5. Ça suffit à redonner du poids à l'or.

À faire en **étape 0**, avant Tailwind : c'est 5 lignes de CSS et ça se voit immédiatement.

### Les 3 réglages "clean & pro" sans perdre le fun

1. **Typo** : garder Crimson Pro (corps) + Metamorphous (titres). C'est l'âme RPG.
   Mais réduire les tailles de titre et resserrer l'interlignage → ça fait pro tout de suite.
2. **Rayons** : passer de rayons variés (6→20px) à 3 valeurs seulement (`sm/md/lg`).
   Trop de rayons différents = amateur.
3. **Ombres** : une seule ombre douce, plus discrète. Les grosses ombres font "template 2015".

Le "gaming" reste dans : la palette chaude, les icônes Lucide expressives, les micro-animations,
les badges colorés, les textures de fond radiales.

---

## Étapes

> **État** : étapes 0 à 4 ✅ faites (sauf `AppSelect`, décision en attente).
> Prochaine : étape 5 (passe clean & pro).
>
> Découvertes en cours de route :
> - `font-size` racine = 18px → il a fallu fixer `--spacing: 4px` sinon toutes
>   les unités rem de Tailwind sont 12% trop grandes.
> - Sans preflight, `border-style` vaut `none` → `border-solid` obligatoire
>   partout où il y a une bordure.
> - Les 3 thèmes ciblent `.btn` / `.card` / `.badge` / `.icon-btn`. On garde ces
>   classes sur les composants et on ne supprime que les règles **de base**.
> - `AppInput` utilise `.app-input`, mais les thèmes ciblent `.input` → **les
>   inputs ne sont pas thémés**. Bug préexistant, à corriger à l'étape 5.

### Étape 1 — Installer Tailwind v4 ✅
- `npm i -D tailwindcss @tailwindcss/vite -w client`
- Ajouter `tailwindcss()` dans `client/vite.config.ts`.
- Dans `style.css` : `@import "tailwindcss";` en haut + le bloc `@theme inline` ci-dessus.
- **Ne rien supprimer** de `style.css` pour l'instant.
- ✅ Vérif : `npm run dev`, l'app est **visuellement identique**. Une classe test `class="p-4"` marche.

### Étape 2 — Installer shadcn-vue ✅
- Alias `@` → `client/src` dans `vite.config.ts` et `tsconfig.json` (requis par shadcn).
- `npx shadcn-vue@latest init` → base color `neutral`, CSS variables `oui`, dir `src/components/shadcn`.
- Installer `reka-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- Créer `src/utils/cn.ts` (helper `cn()`).
- ✅ Vérif : `npx shadcn-vue add button`, l'app compile toujours.

### Étape 3 — Composants "simples" (pas de reka-ui, juste CVA + Tailwind) ✅
Ordre : du moins risqué au plus utilisé.

| # | Composant | Base shadcn | Note |
|---|---|---|---|
| 3.1 | `AppBadge` | `badge` | 6 variantes RPG à porter en CVA |
| 3.2 | `AppCard` | `card` | garder les slots `#titleActions` |
| 3.3 | `AppButton` | `button` | garder `variant`/`size`/`block` à l'identique |
| 3.4 | `AppIconBtn` | `button` size icon | 40×40, prop `size` conservée |
| 3.5 | `AppInput` / `AppTextarea` | `input` / `textarea` | garder l'émission de nombres |
| 3.6 | `AppEmptyState` | — | juste du Tailwind |

Pour chacun → verif : la page qui l'utilise le plus est inchangée à l'œil, mobile compris.

**Point d'attention** : `.btn` et `.input` sont dans `style.css` global et utilisés hors des
composants (`.hp-btn`, `<select class="input">`…). On les garde jusqu'à l'étape 6.

### Étape 4 — Composants avec primitives reka-ui
Là on gagne vraiment (a11y + comportement).

| # | Composant | Primitive | État |
|---|---|---|---|
| 4.1 | `AppModal` | reka `DialogRoot` | ✅ |
| 4.2 | `AppBottomSheet` | reka `DialogRoot` | ✅ |
| 4.3 | `AppTabs` | reka `TabsRoot` | ✅ |
| 4.4 | `AppToast` | — | ⏭️ gardé, voir plus bas |
| 4.5 | `AppSelect` | — | ⏭️ à décider, voir plus bas |

**On utilise reka-ui directement, pas les wrappers shadcn.** Leur `DialogContent`
impose un look totalement différent du nôtre et dépend de `tw-animate-css`.
reka-ui est le moteur *derrière* shadcn-vue — on prend le moteur, pas la carrosserie.

**`AppBottomSheet` n'avait aucune logique de swipe** (contrairement à ce que le plan
supposait). C'est un simple dialogue ancré en bas → pas besoin de `vaul-vue`.

**`AppToast` gardé tel quel.** Passer à `sonner` obligerait à réécrire le composable
`useToast` et tous ses appelants, pour un gain nul. Le vrai manque était l'annonce
vocale → `role="status"` + `aria-live="polite"` ajoutés. 2 attributs au lieu d'une dép.

**`AppSelect` : décision en attente.** Le remplacer par une liste custom fait perdre
le picker natif du téléphone (roue iOS / liste Android), qui est une très bonne UX.
L'app est pensée mobile d'abord. Coût de migration : 26 `<option>` dans 6 fichiers.
→ Recommandation : **garder le `<select>` natif**, et n'introduire une liste custom
que si on a besoin d'une recherche dans les longues listes (armes, races).

Vérif par composant : ouverture/fermeture, Escape, clic dehors, focus au clavier, mobile.

### Étape 5 — Passe "clean & pro"
Une fois la base en place, une seule PR de polish :
- Réduire l'échelle de rayons à 3 valeurs.
- Une ombre unique, plus douce.
- Harmoniser les tailles de titres.
- Uniformiser les hauteurs (boutons 40px, inputs 38px → tout à 40px).

À faire **avec l'agent `ux-designer`** avant de coder, pour avoir une proposition concrète.

### Étape 6 — Nettoyage
- Supprimer de `style.css` ce qui est devenu mort (`.btn`, `.input`) une fois les derniers
  usages hors-composants migrés (`<select class="input">`, `.hp-btn`, `.dice-btn`, `.mode-tab`).
- Mettre à jour le catalogue de composants dans `CLAUDE.md`.
- ✅ Vérif finale : `npm run build` (vue-tsc passe), `npm test`, puis agent `playtester`
  sur mobile pour valider qu'aucun écran n'a régressé.

---

## Règles pendant la migration

- **Une étape = un commit.** Jamais deux composants dans le même commit.
- Les vues ne changent pas. Si une vue doit changer, c'est que l'API du composant a bougé → à éviter.
- Les nouvelles classes Tailwind restent **dans les composants `ui/`**. Les vues gardent leur CSS scoped
  avec `var(--*)` — on les migrera plus tard, ou jamais. Pas de règle "tout en Tailwind".
- Aucun composant shadcn n'est utilisé directement dans une vue : toujours derrière un `App*`.

## Risques

| Risque | Parade |
|---|---|
| Le dark mode casse | Le pont `@theme inline` le préserve ; tester chaque étape en dark |
| `AppBottomSheet` (157 l., swipe maison) régresse | Étape isolée, garder l'ancien fichier en `.old` le temps du test |
| CSS Tailwind écrase notre CSS scoped | Tailwind v4 a une specificity basse ; en cas de conflit, `@layer` |
| Bundle plus gros | Tailwind purge tout seul ; reka-ui est tree-shakable |
