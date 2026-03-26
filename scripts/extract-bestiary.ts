/**
 * One-shot script: extract monster data from bestiary PNG screenshots.
 *
 * Usage:  npx tsx scripts/extract-bestiary.ts
 *
 * Reads each PNG in knowledge/bestiaire/, sends it to Gemini vision,
 * and outputs:
 *   - scripts/output/monsters.json          (raw structured data)
 *   - client/src/data/monstersCatalog.ts     (typed TS catalog)
 *   - knowledge/topics/bestiaire.md          (markdown for AI)
 */

import { GoogleGenAI } from "@google/genai";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, "../server/.env") });

const BESTIARY_DIR = join(__dirname, "../knowledge/bestiaire");
const OUTPUT_DIR = join(__dirname, "output");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface Monster {
  name: string;
  nc: number;
  size: string;
  stats: { for: number; dex: number; con: number; int: number; sag: number; cha: number };
  def: number;
  pv: number;
  init: number;
  rd?: number;
  attacks: { name: string; bonus: number; damage: string; range?: number }[];
  abilities: { name: string; description: string }[];
  description?: string;
}

const EXTRACTION_PROMPT = `Tu es un extracteur de donnees de bestiaire pour un JDR.

Analyse cette image de page de bestiaire et extrais TOUS les monstres presents sous forme de JSON.

Regles :
- Chaque monstre a un bloc de stats : NC, taille, FOR, DEX, CON, INT, SAG, CHA, DEF, PV, Init.
- Les stats avec un asterisque (ex: "SAG +4*") : ignore l'asterisque, prends le nombre
- Si une entree est juste un renvoi (ex: "Aspic — Voir Dragon"), ignore-la
- Si un monstre commence sur cette page mais ses capacites continuent sur la suivante, extrais ce que tu vois
- Si tu vois la FIN d'un monstre commence sur la page precedente (capacites sans bloc de stats au debut), retourne-le avec le champ "partial_end": true et son nom si visible
- RD (Reduction de Degats) est optionnel
- Les attaques : "Griffes +8" signifie name="Griffes", bonus=8. "DM 2d6+4" signifie damage="2d6+4"
- Certains monstres ont plusieurs attaques
- range = portee en metres si indiquee (pour les attaques a distance)

Retourne un JSON array. Chaque element :
{
  "name": "Nom du monstre",
  "nc": 4,
  "size": "grande",
  "stats": { "for": 16, "dex": 12, "con": 14, "int": 6, "sag": 10, "cha": 8 },
  "def": 18,
  "pv": 50,
  "init": 14,
  "rd": null,
  "attacks": [{ "name": "Griffes", "bonus": 8, "damage": "2d6+4", "range": null }],
  "abilities": [{ "name": "Vol rapide", "description": "..." }],
  "description": "Texte d'ambiance si present, sinon null",
  "partial_end": false
}

IMPORTANT : retourne UNIQUEMENT le JSON array, sans markdown, sans backticks, sans explication.`;

async function extractFromImage(imagePath: string): Promise<Monster[]> {
  const imageData = await readFile(imagePath);
  const base64 = imageData.toString("base64");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: base64 } },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  let text = response.text ?? "";

  // Strip markdown code fences if Gemini wraps the output
  text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();

  try {
    return JSON.parse(text);
  } catch {
    console.error(`  [WARN] Failed to parse JSON for ${imagePath}`);
    console.error(`  ${text.slice(0, 200)}...`);
    // Save raw output for debugging
    const debugPath = imagePath.replace(".png", ".raw.txt");
    await writeFile(debugPath, text);
    return [];
  }
}

function generateMarkdown(monsters: Monster[]): string {
  const lines: string[] = [
    "# Bestiaire",
    "",
    "Liste complete des creatures et monstres du monde d'Arran.",
    "",
  ];

  for (const m of monsters) {
    // Skip category headers without stats
    if (!m.stats) {
      if (m.description) {
        lines.push(`## ${m.name}`);
        lines.push("");
        lines.push(m.description);
        lines.push("");
        lines.push("---");
        lines.push("");
      }
      continue;
    }

    lines.push(`## ${m.name}`);
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

    if (m.attacks.length > 0) {
      lines.push("**Attaques :**");
      for (const a of m.attacks) {
        const rangeStr = a.range ? ` (${a.range} m)` : "";
        lines.push(`- ${a.name} +${a.bonus}, DM ${a.damage}${rangeStr}`);
      }
      lines.push("");
    }

    if (m.abilities.length > 0) {
      lines.push("**Capacites :**");
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

function generateCatalogTS(monsters: Monster[]): string {
  const lines: string[] = [
    "// Auto-generated from scripts/extract-bestiary.ts — do not edit by hand",
    "",
    "export interface Monster {",
    "  name: string",
    "  nc: number",
    '  size: "petite" | "moyenne" | "grande" | "enorme" | "colossale" | "tres petite" | "minuscule"',
    "  stats: { for: number; dex: number; con: number; int: number; sag: number; cha: number }",
    "  def: number",
    "  pv: number",
    "  init: number",
    "  rd?: number",
    "  attacks: { name: string; bonus: number; damage: string; range?: number }[]",
    "  abilities: { name: string; description: string }[]",
    "  description?: string",
    "}",
    "",
    "export const MONSTERS_CATALOG: Monster[] = ",
  ];

  return lines.join("\n") + JSON.stringify(monsters, null, 2) + "\n";
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(BESTIARY_DIR))
    .filter((f) => f.endsWith(".png"))
    .sort((a, b) => parseInt(a) - parseInt(b));

  console.log(`Found ${files.length} bestiary images\n`);

  const allMonsters: Monster[] = [];
  const partialEnds: any[] = [];

  for (const file of files) {
    const path = join(BESTIARY_DIR, file);
    console.log(`Processing ${file}...`);

    const monsters = await extractFromImage(path);
    console.log(`  -> ${monsters.length} monster(s) extracted`);

    for (const m of monsters) {
      if ((m as any).partial_end) {
        partialEnds.push({ file, ...m });
        continue;
      }
      allMonsters.push(m);
    }
  }

  // Deduplicate by name+nc (in case same monster appears on consecutive pages)
  const seen = new Set<string>();
  const deduplicated: Monster[] = [];
  for (const m of allMonsters) {
    const key = `${m.name}|${m.nc}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(m);
    }
  }

  // Sort by name
  deduplicated.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // Clean up
  const cleaned = deduplicated.map((m) => {
    const { ...rest } = m;
    delete (rest as any).partial_end;
    return {
      ...rest,
      rd: rest.rd ?? undefined,
      attacks: (rest.attacks || []).map((a) => ({
        ...a,
        range: a.range ?? undefined,
      })),
      description: rest.description ?? undefined,
    };
  });

  console.log(`\n${cleaned.length} unique monsters extracted (${partialEnds.length} partial ends merged/skipped)`);

  // Write raw JSON
  const jsonPath = join(OUTPUT_DIR, "monsters.json");
  await writeFile(jsonPath, JSON.stringify(cleaned, null, 2));
  console.log(`Written: ${jsonPath}`);

  // Write TS catalog
  const catalogPath = join(__dirname, "../client/src/data/monstersCatalog.ts");
  await writeFile(catalogPath, generateCatalogTS(cleaned));
  console.log(`Written: ${catalogPath}`);

  // Write knowledge markdown
  const mdPath = join(__dirname, "../knowledge/topics/bestiaire.md");
  await writeFile(mdPath, generateMarkdown(cleaned));
  console.log(`Written: ${mdPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
