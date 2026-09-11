import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KNOWLEDGE_DIR } from "../paths.js";
import { TOPIC_NAMES } from "./tools.js";

const TOPICS_DIR = join(KNOWLEDGE_DIR, "topics");

/** Le bestiaire est le seul topic hors contexte : 65k tokens, lu a la demande via get_monstre. */
export const BESTIAIRE_TOPIC = "bestiaire";

function readTopic(name: string): string {
  return readFileSync(join(TOPICS_DIR, `${name}.md`), "utf8");
}

/**
 * Concatene l'index et tous les topics SAUF le bestiaire.
 * Appele une seule fois au demarrage : ce bloc est la tete du prompt cache.
 */
export function loadAllKnowledge(): string {
  const index = readTopic("00-index");
  const topics = TOPIC_NAMES.filter((n) => n !== BESTIAIRE_TOPIC).map(
    (n) => `\n\n---\n\n${readTopic(n)}`
  );
  return index + topics.join("");
}

export function loadBestiaire(): string {
  return readTopic(BESTIAIRE_TOPIC);
}

/** Normalise pour comparer : sans accent, sans casse, sans espaces superflus. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

type Section = { name: string; start: number; end: number };

/** Decoupe le bestiaire sur ses titres `## `. La derniere fiche va jusqu'a la fin du fichier. */
function sections(bestiaire: string): Section[] {
  const re = /^## +(.+?)[ \t]*$/gm;
  const found: Array<{ name: string; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(bestiaire)) !== null) {
    found.push({ name: m[1], start: m.index });
  }
  return found.map((f, i) => ({
    name: f.name,
    start: f.start,
    end: i + 1 < found.length ? found[i + 1].start : bestiaire.length,
  }));
}

/** La liste des noms de monstres, telle qu'affichee au modele dans le bloc cache. */
export function loadMonsterNames(bestiaire: string): string[] {
  return sections(bestiaire).map((s) => s.name);
}

/** La fiche d'un monstre, insensible a la casse et aux accents. `null` si inconnu. */
export function loadMonster(bestiaire: string, nom: string): string | null {
  const wanted = normalize(nom);
  if (wanted === "") return null;
  const match = sections(bestiaire).find((s) => normalize(s.name) === wanted);
  if (!match) return null;
  return bestiaire.slice(match.start, match.end).trim();
}

/**
 * Le bloc immuable du prompt : preambule + regles + noms de monstres.
 * Rien de variable ici — un octet qui change invalide tout le cache de prefixe.
 */
export function buildStaticBlock(
  preamble: string,
  knowledge: string,
  monsterNames: string[]
): string {
  return (
    `${preamble}\n\n# Regles et lore des Terres d'Arran\n\n${knowledge}` +
    `\n\n---\n\n# Bestiaire — index des creatures\n\n` +
    `Les ${monsterNames.length} creatures repertoriees. Leur fiche detaillee se lit avec l'outil get_monstre.\n\n` +
    monsterNames.map((n) => `- ${n}`).join("\n")
  );
}
