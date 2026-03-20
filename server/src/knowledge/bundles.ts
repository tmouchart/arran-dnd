/**
 * Topic bundles: which Markdown files under knowledge/ to inject per request.
 * Paths are relative to knowledge/.
 */
export const BUNDLES: Record<string, string[]> = {
  core: [
    "topics/00-index.md",
    "topics/creation-personnage.md",
    "topics/combat.md",
    "topics/magie.md",
    "topics/monde-arran.md",
    "topics/races.md",
    "topics/voies-de-profil.md",
    "topics/voies-de-prestige.md",
  ],
  creation: [
    "topics/00-index.md",
    "topics/creation-personnage.md",
    "topics/races.md",
  ],
  combat: ["topics/00-index.md", "topics/combat.md"],
  magic: ["topics/00-index.md", "topics/magie.md"],
  monde: ["topics/00-index.md", "topics/monde-arran.md"],
  voies: [
    "topics/00-index.md",
    "topics/creation-personnage.md",
    "topics/voies-de-profil.md",
    "topics/voies-de-prestige.md",
  ],
};

export const DEFAULT_BUNDLE = "core";

export function listBundles(): string[] {
  return Object.keys(BUNDLES);
}
