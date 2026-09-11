// Section "combat en cours" du prompt d'Isilwen. Tout est pur ici : la sortie
// de serializeCombat arrive deja masquee (vue MJ ou vue joueur), les jets
// arrivent deja filtres par visibilite. index.ts ne fait que charger.

import type { serializeCombat } from "../combats/serialize.js";

export type SerializedCombat = ReturnType<typeof serializeCombat>;
export type SerializedParticipant = SerializedCombat["participants"][number];

export type CombatRoll = {
  actorName: string;
  label: string;
  total: number;
  damage: { total: number; critical: boolean; fumble: boolean } | null;
};

type Attack = { name: string; bonus: number; damage: string; range?: number };
type Ability = { name: string; description: string };

const ETAT_LABELS: Record<string, string> = {
  aveugle: "aveugle",
  affaibli: "affaibli",
  etourdi: "étourdi",
  immobilise: "immobilisé",
  paralyse: "paralysé",
  ralenti: "ralenti",
  renverse: "renversé",
  surpris: "surpris",
  desarme: "désarmé",
  bloque: "bloqué",
  repousse: "repoussé",
  diversion: "diversion",
  menace: "menacé",
};

const HP_STATUS_LABELS: Record<string, string> = {
  intact: "intact",
  blesse: "blessé",
  mal_en_point: "mal en point",
  agonisant: "agonisant",
  mort: "mort",
};

function etatLabel(id: string): string {
  return ETAT_LABELS[id] ?? id;
}

function signed(n: number | null): string {
  if (n == null) return "?";
  return n >= 0 ? `+${n}` : `${n}`;
}

function statesPart(states: string[]): string[] {
  return states.length > 0 ? [`états : ${states.map(etatLabel).join(", ")}`] : [];
}

/** La partie apres le tiret : "PV 12/34, DEF 16, états : renversé". */
function describeParticipant(p: SerializedParticipant, isGm: boolean): string {
  const parts: string[] = [];
  if (p.kind === "player") {
    parts.push(`PV ${p.hpCurrent ?? "?"}/${p.hpMax ?? "?"}`, `DEF ${p.def}`);
  } else if (!isGm) {
    // Vue joueur : un monstre n'a qu'un etat qualitatif.
    parts.push(HP_STATUS_LABELS[String((p as { hpStatus?: string }).hpStatus)] ?? "?");
  } else {
    parts.push(
      `PV ${p.hpCurrent ?? "?"}/${p.hpMax ?? "?"}`,
      `DEF ${p.def}`,
      `NC ${p.nc ?? "?"}`,
      `init ${p.initiative}`,
      `FOR ${signed(p.statFor)} DEX ${signed(p.statDex)} CON ${signed(p.statCon)} INT ${signed(p.statInt)} SAG ${signed(p.statSag)} CHA ${signed(p.statCha)}`,
    );
  }
  parts.push(...statesPart(p.states ?? []));
  return parts.join(", ");
}

/** Attaques et capacites d'un monstre, vue MJ seulement. Lignes indentees. */
function monsterDetails(p: SerializedParticipant): string[] {
  const lines: string[] = [];
  const attacks = (p.attacks as Attack[] | null) ?? [];
  if (attacks.length > 0) {
    const txt = attacks
      .map((a) => `${a.name} ${signed(a.bonus)}, ${a.damage}${a.range ? ` (portée ${a.range} m)` : ""}`)
      .join(" ; ");
    lines.push(`   Attaques : ${txt}`);
  }
  const abilities = (p.abilities as Ability[] | null) ?? [];
  if (abilities.length > 0) {
    lines.push(`   Capacités : ${abilities.map((a) => `${a.name} : ${a.description}`).join(" ; ")}`);
  }
  return lines;
}

function kindLabel(kind: string): string {
  return kind === "player" ? "joueur" : "monstre";
}

function renderRoll(r: CombatRoll): string {
  let out = `- ${r.actorName} : ${r.label} → ${r.total}`;
  const extras: string[] = [];
  if (r.damage) {
    extras.push(`dégâts ${r.damage.total}`);
    if (r.damage.critical) extras.push("critique");
    if (r.damage.fumble) extras.push("fumble");
  }
  if (extras.length > 0) out += ` (${extras.join(", ")})`;
  return out;
}

/**
 * Construit la section "## Combat en cours", inseree apres la section campagne.
 * `serialized` vient de serializeCombat (deja masque selon le role), `rolls`
 * sont les derniers jets deja filtres par visibilite, `userId` sert a la ligne
 * "Tu es X" quand l'utilisateur a un participant dans le combat.
 */
export function buildCombatSection(serialized: SerializedCombat, rolls: CombatRoll[], userId: number): string {
  const { isGm, participants, reserve, currentTurnIndex } = serialized;
  const current = currentTurnIndex >= 0 ? participants[currentTurnIndex] : undefined;

  let out = `\n\n## Combat en cours : ${serialized.name}\n`;
  out += `Round ${serialized.roundNumber}. C'est le tour de : ${current ? current.name : "personne"}.\n`;
  // Sans cette ligne, la regle "jamais de chiffres de monstres aux joueurs"
  // l'emporte et elle refuse au MJ ce qu'elle a sous les yeux.
  if (isGm) out += "Tu parles au meneur de jeu : les chiffres des monstres ci-dessous sont pour lui, donne-les-lui sans détour.\n";

  const me = participants.find((p) => p.kind === "player" && p.userId === userId);
  if (me) out += `Tu es ${me.name} (${describeParticipant(me, isGm)}).\n`;

  out += "\nOrdre d'initiative :\n";
  if (participants.length === 0) out += "Aucun participant.\n";
  participants.forEach((p, i) => {
    const marker = i === currentTurnIndex ? "  ← tour en cours" : "";
    out += `${i + 1}. ${p.name} (${kindLabel(p.kind)}) — ${describeParticipant(p, isGm)}${marker}\n`;
    if (isGm && p.kind === "monster") out += monsterDetails(p).map((l) => `${l}\n`).join("");
  });

  if (isGm) {
    out += "\nRéserve (cachés aux joueurs) :\n";
    if (reserve.length === 0) out += "Aucun.\n";
    for (const p of reserve) {
      out += `- ${p.name} (${kindLabel(p.kind)}) — ${describeParticipant(p, isGm)}\n`;
      if (p.kind === "monster") out += monsterDetails(p).map((l) => `${l}\n`).join("");
    }
  }

  out += "\nDerniers jets du combat :\n";
  out += rolls.length === 0 ? "Aucun jet pour l'instant." : rolls.map(renderRoll).join("\n");

  return out;
}
