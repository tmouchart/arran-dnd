import { describe, it, expect } from "vitest";
import {
  buildCampaignSection,
  trimCampaignContext,
  type JournalContext,
  type PartyContext,
} from "./campaignContext.js";

const OMITTED = /\[…(\d+) caractères omis\]/;

const EMPTY_JOURNAL: JournalContext = { content: "", editedBy: null, pages: [], notes: [] };

function party(overrides: Partial<PartyContext> = {}): PartyContext {
  return {
    campaignId: 1,
    campaignName: "Bac à sable",
    gmUserId: 1,
    members: [
      { characterId: 10, name: "Bracco", people: "Humain", profile: "Guerrier", culturalPath: null, portraitImageId: null },
    ],
    codex: [],
    ...overrides,
  };
}

describe("trimCampaignContext", () => {
  it("garde la fin d'un journal de 100 000 caracteres et signale l'omission", () => {
    const journal = "DEBUT" + "x".repeat(100000) + "FIN";
    const res = trimCampaignContext({ journal, codex: "", notes: [] }, 60000);

    expect(res.journal.endsWith("FIN")).toBe(true);
    expect(res.journal).not.toContain("DEBUT");
    const m = res.journal.match(OMITTED);
    expect(m).not.toBeNull();
    const omitted = Number(m![1]);
    expect(omitted).toBe(journal.length - 60000);
    // Le contenu garde (hors ligne d'omission) fait exactement la taille max.
    expect(res.journal.length - (m![0].length + 1)).toBe(60000);
  });

  it("coupe les notes avant le journal, la plus ancienne en premier", () => {
    const journal = "J".repeat(1000);
    const notes = ["ancienne".padEnd(400, "a"), "milieu".padEnd(400, "m"), "recente".padEnd(400, "r")];
    // total = 2200, max 1500 → retirer la note 0 (1800) ne suffit pas, il faut aussi la note 1 (1400).
    const res = trimCampaignContext({ journal, codex: "", notes }, 1500);

    expect(res.journal).toBe(journal);
    expect(res.notes).toHaveLength(2);
    expect(res.notes[0]).toMatch(OMITTED);
    expect(res.notes[0]).toContain("800");
    expect(res.notes[1]).toBe(notes[2]);
  });

  it("entame le journal seulement quand toutes les notes sont parties", () => {
    const journal = "DEBUT" + "x".repeat(1000) + "FIN";
    const notes = ["n".repeat(100)];
    const res = trimCampaignContext({ journal, codex: "", notes }, 500);

    expect(res.notes).toHaveLength(1);
    expect(res.notes[0]).toMatch(OMITTED);
    expect(res.journal).toMatch(OMITTED);
    expect(res.journal.endsWith("FIN")).toBe(true);
    expect(res.journal).not.toContain("DEBUT");
  });

  it("ne touche a rien quand tout tient", () => {
    const input = { journal: "petit journal", codex: "- [PNJ] Bob — tavernier", notes: ["note 1", "note 2"] };
    const res = trimCampaignContext(input, 60000);

    expect(res).toEqual(input);
    expect(res.journal).not.toMatch(OMITTED);
    expect(res.notes.some((n) => OMITTED.test(n))).toBe(false);
  });
});

describe("buildCampaignSection", () => {
  it("ecrit le titre de la campagne meme sans compagnon", () => {
    const out = buildCampaignSection(party(), 10, EMPTY_JOURNAL);

    expect(out).toContain("## Campagne : Bac à sable");
    expect(out).not.toContain("### Compagnons de campagne");
  });

  it("exclut le personnage actif des compagnons", () => {
    const p = party({
      members: [
        { characterId: 10, name: "Bracco", people: "Humain", profile: "Guerrier", culturalPath: null, portraitImageId: null },
        { characterId: 11, name: "Nym", people: "Elfe", profile: "Mage", culturalPath: "Sylvestre", portraitImageId: null },
      ],
    });
    const out = buildCampaignSection(p, 10, EMPTY_JOURNAL);

    expect(out).toContain("### Compagnons de campagne");
    expect(out).toContain("- Nym, Elfe, profil Mage, voie culturelle : Sylvestre");
    expect(out).not.toContain("- Bracco");
  });

  it("rend des placeholders explicites quand codex, journal, pages et notes sont vides", () => {
    const out = buildCampaignSection(party(), 10, EMPTY_JOURNAL);

    expect(out).toContain("## Codex de la campagne\n\nLe codex est vide.");
    expect(out).toContain("## Journal de bord\n\nLe journal de bord est vide.");
    expect(out).toContain("## Pages partagées\n\nAucune page partagée.");
    expect(out).toContain("## Tes notes privées\n\nAucune note.");
    expect(out).not.toContain("Dernière modification par");
  });

  it("sans campagne active, ne rend ni titre de campagne ni codex", () => {
    const journal: JournalContext = {
      content: "Il etait une fois",
      editedBy: "nym",
      pages: [{ id: 3, title: "Carte" }],
      notes: [{ title: "", content: "penser a acheter des cordes" }],
    };
    const out = buildCampaignSection(null, 10, journal);

    expect(out).not.toContain("## Campagne");
    expect(out).not.toContain("## Codex");
    expect(out).toContain("Dernière modification par : nym");
    expect(out).toContain("Il etait une fois");
    expect(out).toContain("- (3) Carte");
    expect(out).toContain("### Sans titre\npenser a acheter des cordes");
  });
});
