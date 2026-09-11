import { describe, it, expect } from "vitest";
import { buildCombatSection, type CombatRoll } from "./combatContext.js";
import { serializeCombat } from "../combats/serialize.js";
import { combatParticipants, combats } from "../db/schema.js";

type CombatRow = typeof combats.$inferSelect;
type ParticipantRow = typeof combatParticipants.$inferSelect;

function combat(overrides: Partial<CombatRow> = {}): CombatRow {
  return {
    id: 1,
    campaignId: 1,
    encounterId: null,
    name: "Embuscade au gué",
    status: "active",
    currentParticipantId: null,
    roundNumber: 3,
    environment: "foret",
    obstacles: [],
    createdAt: new Date("2026-01-01"),
    finishedAt: null,
    ...overrides,
  } as CombatRow;
}

function monster(overrides: Partial<ParticipantRow> = {}): ParticipantRow {
  return {
    id: 10,
    combatId: 1,
    kind: "monster",
    userId: null,
    name: "Gobelin archer",
    initiative: 6,
    hpMax: 20,
    hpCurrent: 12,
    def: 13,
    nc: 1,
    statFor: 2, statDex: 1, statCon: 0, statInt: -1, statSag: 0, statCha: -2,
    attacks: [{ name: "Arc court", bonus: 4, damage: "1d6+1", range: 30 }],
    abilities: [{ name: "Tir précis", description: "Ignore le couvert." }],
    monsterDescription: "Petit et sournois.",
    states: [],
    posX: 2,
    posY: -1,
    hidden: false,
    ...overrides,
  } as ParticipantRow;
}

function player(overrides: Partial<ParticipantRow> = {}): ParticipantRow {
  return monster({
    id: 20,
    kind: "player",
    userId: 7,
    name: "Nym",
    initiative: 18,
    hpMax: 34,
    hpCurrent: 12,
    def: 16,
    nc: null,
    attacks: null,
    abilities: null,
    monsterDescription: null,
    states: [],
    ...overrides,
  });
}

const PARTS = [
  player({ id: 20, initiative: 18 }),
  monster({ id: 10, initiative: 6 }),
  monster({ id: 11, name: "Sarkan le Brûlé", initiative: 30, hidden: true }),
];

function section(isGm: boolean, userId = 7, rolls: CombatRoll[] = [], c = combat({ currentParticipantId: 20 })) {
  return buildCombatSection(serializeCombat(c, PARTS, isGm), rolls, userId);
}

describe("buildCombatSection — vue joueur", () => {
  const out = section(false);

  it("ne montre d'un monstre que son état qualitatif", () => {
    expect(out).toContain("2. Gobelin archer (monstre) — blessé");
    expect(out).not.toContain("PV 12/20");
    expect(out).not.toContain("DEF 13");
    expect(out).not.toContain("NC 1");
    expect(out).not.toContain("Attaques");
    expect(out).not.toContain("Arc court");
    expect(out).not.toContain("Capacités");
  });

  it("ne montre pas la réserve", () => {
    expect(out).not.toContain("Réserve");
    expect(out).not.toContain("Sarkan");
  });

  it("montre les PV et la DEF d'un joueur", () => {
    expect(out).toContain("1. Nym (joueur) — PV 12/34, DEF 16");
  });
});

describe("buildCombatSection — vue MJ", () => {
  const out = section(true, 1);

  it("montre PV, DEF, NC, attaques et capacités du monstre", () => {
    expect(out).toContain("2. Gobelin archer (monstre) — PV 12/20, DEF 13, NC 1, init 6, FOR +2 DEX +1 CON +0 INT -1 SAG +0 CHA -2");
    expect(out).toContain("   Attaques : Arc court +4, 1d6+1 (portée 30 m)");
    expect(out).toContain("   Capacités : Tir précis : Ignore le couvert.");
  });

  it("montre la réserve avec le participant caché", () => {
    expect(out).toContain("Réserve (cachés aux joueurs) :\n- Sarkan le Brûlé (monstre) — PV 12/20, DEF 13");
  });
});

describe("buildCombatSection — le tour", () => {
  it("pointe le participant courant et marque sa ligne", () => {
    const out = section(false, 7, [], combat({ currentParticipantId: 10 }));
    expect(out).toContain("Round 3. C'est le tour de : Gobelin archer.");
    expect(out).toContain("2. Gobelin archer (monstre) — blessé  ← tour en cours");
    expect(out).not.toContain("Nym (joueur) — PV 12/34, DEF 16  ← tour en cours");
  });

  it("dit « personne » quand le tour ne pointe sur personne", () => {
    const out = section(false, 7, [], combat({ currentParticipantId: null }));
    expect(out).toContain("C'est le tour de : personne.");
    expect(out).not.toContain("← tour en cours");
  });
});

describe("buildCombatSection — Tu es X", () => {
  it("présent pour un joueur qui a un perso dans le combat", () => {
    expect(section(false, 7)).toContain("Tu es Nym (PV 12/34, DEF 16).");
  });

  it("absent pour un MJ sans perso dans le combat", () => {
    expect(section(true, 1)).not.toContain("Tu es ");
  });
});

describe("buildCombatSection — les jets", () => {
  it("formate dégâts, critique et fumble", () => {
    const rolls: CombatRoll[] = [
      { actorName: "Nym", label: "Attaque épée", total: 17, damage: { total: 6, critical: false, fumble: false } },
      { actorName: "Bracco", label: "Attaque hache", total: 20, damage: { total: 12, critical: true, fumble: false } },
      { actorName: "Gobelin archer", label: "Attaque arc", total: 1, damage: { total: 0, critical: false, fumble: true } },
      { actorName: "Nym", label: "Initiative", total: 14, damage: null },
    ];
    const out = section(false, 7, rolls);
    expect(out).toContain("- Nym : Attaque épée → 17 (dégâts 6)");
    expect(out).toContain("- Bracco : Attaque hache → 20 (dégâts 12, critique)");
    expect(out).toContain("- Gobelin archer : Attaque arc → 1 (dégâts 0, fumble)");
    expect(out.endsWith("- Nym : Initiative → 14")).toBe(true);
  });

  it("dit qu'il n'y a aucun jet sans jets", () => {
    expect(section(false)).toContain("Derniers jets du combat :\nAucun jet pour l'instant.");
  });
});

describe("buildCombatSection — les états", () => {
  it("traduit les identifiants en libellés lisibles", () => {
    const parts = [
      player({ id: 20, states: ["renverse"] }),
      monster({ id: 10, hpCurrent: 8, states: ["etourdi"] }),
    ];
    const out = buildCombatSection(serializeCombat(combat(), parts, false), [], 7);
    expect(out).toContain("Nym (joueur) — PV 12/34, DEF 16, états : renversé");
    expect(out).toContain("Gobelin archer (monstre) — mal en point, états : étourdi");
  });
});
