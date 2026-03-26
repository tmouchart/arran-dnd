/**
 * Regenerate monstersCatalog.ts and bestiaire.md from the already-extracted monsters.json.
 * Usage: npx tsx scripts/regenerate-bestiary-outputs.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Monster {
  name: string;
  nc: number;
  size: string;
  stats: { for: number; dex: number; con: number; int: number; sag: number; cha: number } | null;
  def: number;
  pv: number;
  init: number;
  rd?: string | number;
  attacks: { name: string; bonus: number; damage: string; range?: number }[];
  abilities: { name: string; description: string }[];
  description?: string;
}

function generateMarkdown(monsters: Monster[]): string {
  const lines: string[] = [
    "# Bestiaire",
    "",
    "Liste complète des créatures et monstres du monde d'Arran.",
    "",
  ];

  for (const m of monsters) {
    const displayName = normalizeName(m.name);
    if (!m.stats) {
      if (m.description) {
        lines.push(`## ${displayName}`);
        lines.push("");
        lines.push(m.description);
        lines.push("");
        lines.push("---");
        lines.push("");
      }
      continue;
    }

    lines.push(`## ${displayName}`);
    lines.push("");
    if (m.description) {
      lines.push(m.description);
      lines.push("");
    }
    lines.push(`**NC** ${m.nc}, taille ${m.size}  `);
    const s = m.stats;
    lines.push(
      `**FOR** ${s.for >= 0 ? "+" : ""}${s.for} | **DEX** ${s.dex >= 0 ? "+" : ""}${s.dex} | **CON** ${s.con >= 0 ? "+" : ""}${s.con} | **INT** ${s.int >= 0 ? "+" : ""}${s.int} | **SAG** ${s.sag >= 0 ? "+" : ""}${s.sag} | **CHA** ${s.cha >= 0 ? "+" : ""}${s.cha}  `
    );
    lines.push(`**DEF** ${m.def} | **PV** ${m.pv} | **Init.** ${m.init}${m.rd ? ` | **RD** ${m.rd}` : ""}  `);
    lines.push("");

    if (m.attacks && m.attacks.length > 0) {
      lines.push("**Attaques :**");
      for (const a of m.attacks) {
        const rangeStr = a.range ? ` (${a.range} m)` : "";
        lines.push(`- ${a.name} +${a.bonus}, DM ${a.damage}${rangeStr}`);
      }
      lines.push("");
    }

    if (m.abilities && m.abilities.length > 0) {
      lines.push("**Capacités :**");
      for (const ab of m.abilities) {
        lines.push(`- **${ab.name}** : ${ab.description}`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/** Normalize monster name: "AIGLE GÉANT ADULTE" → "Aigle géant adulte" */
function normalizeName(name: string): string {
  const lower = name.toLowerCase();
  // Uppercase first letter only
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const SIZE_MAP: Record<string, string> = {
  "très petite": "tres petite",
  "tres petite": "tres petite",
  "minuscule": "minuscule",
  "petite": "petite",
  "moyenne": "moyenne",
  "moyen": "moyenne",
  "grande": "grande",
  "énorme": "enorme",
  "enorme": "enorme",
  "colossale": "colossale",
};

function sanitizeMonster(m: Monster): Monster | null {
  if (!m.stats || m.stats.for == null || m.nc == null) return null;

  const size = SIZE_MAP[(m.size || "").toLowerCase()] || "moyenne";
  const nc = typeof m.nc === "number" ? m.nc : parseFloat(String(m.nc)) || 0;
  const def = typeof m.def === "number" ? m.def : parseInt(String(m.def)) || 10;
  const pv = typeof m.pv === "number" ? m.pv : parseInt(String(m.pv)) || 1;
  const init = typeof m.init === "number" ? m.init : parseInt(String(m.init)) || 10;

  const attacks = (m.attacks || [])
    .filter((a) => a.name)
    .map((a) => ({
      name: String(a.name),
      bonus: typeof a.bonus === "number" ? a.bonus : parseInt(String(a.bonus)) || 0,
      damage: String(a.damage || "1d4"),
      ...(a.range != null ? { range: typeof a.range === "number" ? a.range : parseInt(String(a.range)) || undefined } : {}),
    }));

  const abilities = (m.abilities || [])
    .filter((a) => a.name && a.description)
    .map((a) => ({
      name: String(a.name),
      description: String(a.description),
    }));

  return {
    name: normalizeName(m.name),
    nc,
    size,
    stats: {
      for: Number(m.stats.for) || 0,
      dex: Number(m.stats.dex) || 0,
      con: Number(m.stats.con) || 0,
      int: Number(m.stats.int) || 0,
      sag: Number(m.stats.sag) || 0,
      cha: Number(m.stats.cha) || 0,
    },
    def,
    pv,
    init,
    ...(m.rd != null ? { rd: String(m.rd) } : {}),
    attacks,
    abilities,
    ...(m.description ? { description: m.description } : {}),
  };
}

function generateCatalogTS(monsters: Monster[]): string {
  const cleaned = monsters
    .map(sanitizeMonster)
    .filter((m): m is Monster => m != null);

  const lines: string[] = [
    "// Auto-generated from scripts/extract-bestiary.ts — do not edit by hand",
    "",
    "export interface Monster {",
    "  name: string",
    "  nc: number",
    "  size: string",
    "  stats: { for: number; dex: number; con: number; int: number; sag: number; cha: number }",
    "  def: number",
    "  pv: number",
    "  init: number",
    "  rd?: string",
    "  attacks: { name: string; bonus: number; damage: string; range?: number }[]",
    "  abilities: { name: string; description: string }[]",
    "  description?: string",
    "}",
    "",
    "export const MONSTERS_CATALOG: Monster[] = ",
  ];

  // Strip null values (TS expects undefined, JSON has null)
  const jsonStr = JSON.stringify(cleaned, (_, v) => (v === null ? undefined : v), 2);
  return lines.join("\n") + jsonStr + "\n";
}

async function main() {
  const raw = await readFile(join(__dirname, "output/monsters.json"), "utf8");
  const monsters: Monster[] = JSON.parse(raw);

  console.log(`Loaded ${monsters.length} monsters from JSON`);

  const withStats = monsters.filter((m) => m.stats != null);
  const headers = monsters.filter((m) => m.stats == null);
  console.log(`${withStats.length} with stats, ${headers.length} category headers`);

  // Write TS catalog
  const catalogPath = join(__dirname, "../client/src/data/monstersCatalog.ts");
  await writeFile(catalogPath, generateCatalogTS(monsters));
  console.log(`Written: ${catalogPath}`);

  // Write knowledge markdown
  const mdPath = join(__dirname, "../knowledge/topics/bestiaire.md");
  await writeFile(mdPath, generateMarkdown(monsters));
  console.log(`Written: ${mdPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
