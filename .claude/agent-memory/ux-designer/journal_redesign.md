---
name: journal_redesign
description: Journal feature redesign — player feedback that drove it, and the recommended design direction (Aug 2026)
type: project
---

Player feedback on `client/src/views/JournalView.vue` (3 tabs: Journal de bord/Pages/Notes perso) drove a redesign:
- **Nicolas** (player): private notes are a single unstructured blob (`notes_perso` column), and there's no way to transfer private content to shared — only company-doc → page transfer exists, not perso → anything.
- **Jonathan** (group's scribe/note-taker): wants light markdown formatting + @mention autocomplete linking to player characters and player-created "fiches" (personnage/lieu/autre), plus a per-player compiled view of mentions concerning them, for shared memory.

**Recommended direction** (full proposal delivered 2026-08-11, not yet implemented):
- 3 tabs become: Journal de bord (unchanged, live/locked) / Notes (merged Pages + Notes perso, filterable Privé↔Partagé via chips, private notes become multiple small objects instead of one blob) / Fiches (new tab, list of mentionable entities).
- Private note is a first-class object → "publish" is just a status flip (Send icon, AppButton primary), done as **optimistic UI + undo toast** (not a confirm dialog) because publishing is reversible/non-destructive.
- Deletion safety: private note delete = undo toast (level 1, low friction, "petit groupe d'amis" context). Shared page delete = confirm dialog with danger button (level 2) because it affects the whole group and an invisible undo could confuse a co-editor.
- @mention UX on mobile: suggestion bar anchored above the virtual keyboard (not a floating dropdown at cursor), with an inline "Créer la fiche « X »" option opening a lightweight bottom sheet when no match — mention insertion must not break writing flow.
- Mentioned-fiche display: bottom sheet on mobile / popover on desktop, not a dedicated page — a fiche is a quick aside, not a destination. Deep-dive (mention history) is a secondary drill-down (`ArrowUpRight`), not the default.
- Jonathan's "compiled mentions per player" need: recommended as a per-fiche mention digest (drill-down from the fiche) rather than a 4th nav tab, to keep the app simple per project constraint (small friend group, not Notion).
- Formatting level recommended: light markdown typed directly (bold/italic/headers/lists/@mention), no toolbar buttons — avoids eating mobile keyboard space, assumes players already know markdown from Discord.
- New component needed if implemented: `AppBottomSheet` (doesn't exist yet in `client/src/components/ui/`) — flagged as needing explicit validation before use, per project rule against inventing components silently.

**Why this matters for future UI work**: any journal/notes/mentions implementation should follow this proposal's structure unless the user explicitly changed direction — check with the user first since this was design-only, not yet built.
