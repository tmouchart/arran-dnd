import { describe, it, expect } from "vitest";
import {
  buildStaticBlock,
  loadAllKnowledge,
  loadBestiaire,
  loadMonster,
  loadMonsterNames,
} from "./loadKnowledge.js";

const BESTIAIRE = loadBestiaire();
const NAMES = loadMonsterNames(BESTIAIRE);

/** `grep -c "^## " knowledge/topics/bestiaire.md` au moment de l'ecriture du test. */
const NB_MONSTRES = 214;

/** Le vrai preambule vit dans index.ts, qui demarre le serveur a l'import. On en prend un faux. */
const PREAMBLE = "Tu incarnes Isilwen du Miroir Astral.";

describe("loadMonsterNames", () => {
  it("retourne les 214 fiches du bestiaire", () => {
    expect(NAMES).toHaveLength(NB_MONSTRES);
  });

  it("ne contient ni nom vide ni doublon", () => {
    expect(NAMES.filter((n) => n.trim() === "")).toEqual([]);
    expect(new Set(NAMES).size).toBe(NAMES.length);
  });

  it("ne contient ni diese ni espace en tete", () => {
    for (const name of NAMES) {
      expect(name.startsWith("#")).toBe(false);
      expect(name).toBe(name.trim());
    }
  });
});

describe("loadMonster", () => {
  it("trouve une fiche par son nom exact", () => {
    const fiche = loadMonster(BESTIAIRE, "Aigle géant adulte");
    expect(fiche).not.toBeNull();
    expect(fiche?.startsWith("## Aigle géant adulte")).toBe(true);
  });

  it("ignore la casse", () => {
    const fiche = loadMonster(BESTIAIRE, "AIGLE GEANT ADULTE");
    expect(fiche?.startsWith("## Aigle géant adulte")).toBe(true);
  });

  it("ignore les accents", () => {
    const fiche = loadMonster(BESTIAIRE, "Aigle geant adulte");
    expect(fiche?.startsWith("## Aigle géant adulte")).toBe(true);
  });

  it("retourne null sur un nom inconnu", () => {
    expect(loadMonster(BESTIAIRE, "Poulet de combat")).toBeNull();
  });

  it("retourne null sur une chaine vide", () => {
    expect(loadMonster(BESTIAIRE, "")).toBeNull();
    expect(loadMonster(BESTIAIRE, "   ")).toBeNull();
  });

  it("retourne la derniere fiche du fichier en entier", () => {
    const last = NAMES[NAMES.length - 1];
    const fiche = loadMonster(BESTIAIRE, last);
    expect(fiche).not.toBeNull();
    expect(fiche?.startsWith(`## ${last}`)).toBe(true);
    // Une fiche complete porte toujours ses stats et ses attaques.
    expect(fiche).toContain("**PV**");
    expect(fiche).toContain("**Attaques :**");
    // Elle s'arrete au bout du fichier, sans espaces ni separateur qui trainent.
    expect(fiche).toBe(fiche?.trim());
  });

  it("ne deborde jamais sur la fiche suivante", () => {
    for (let i = 0; i + 1 < NAMES.length; i++) {
      const fiche = loadMonster(BESTIAIRE, NAMES[i]);
      expect(fiche).not.toBeNull();
      const titres = (fiche as string).split("\n").filter((l) => l.startsWith("## "));
      expect(titres).toEqual([`## ${NAMES[i]}`]);
      expect(fiche).not.toContain(`## ${NAMES[i + 1]}`);
    }
  });
});

describe("loadAllKnowledge", () => {
  const knowledge = loadAllKnowledge();

  it("exclut le contenu du bestiaire", () => {
    // Ces deux capacites n'existent que dans bestiaire.md.
    expect(knowledge).not.toContain("Vampirisation");
    expect(knowledge).not.toContain("Vol rapide");
  });

  it("contient les autres topics", () => {
    expect(knowledge).toContain("Tableau des difficultés"); // combat.md
    expect(knowledge).toContain("Nombre total de PM"); // magie.md
  });
});

describe("buildStaticBlock", () => {
  const knowledge = loadAllKnowledge();
  const block = buildStaticBlock(PREAMBLE, knowledge, NAMES);

  it("est identique a parametres identiques (invariant du cache de prefixe)", () => {
    expect(buildStaticBlock(PREAMBLE, knowledge, NAMES)).toBe(block);
    // Les entrees sont relues du disque : meme resultat, octet pour octet.
    expect(buildStaticBlock(PREAMBLE, loadAllKnowledge(), loadMonsterNames(loadBestiaire()))).toBe(
      block
    );
  });

  it("ne contient aucune donnee de personnage", () => {
    // Les en-tetes de fiche injectes par requete (index.ts) n'ont rien a faire ici.
    expect(block).not.toContain("## Personnage actif");
    expect(block).not.toContain("## Fiche de ");
    // Ni aucun nom de personnage du bac a sable.
    for (const nom of ["Bracco", "Nym", "Orlane", "Kaeliss"]) {
      expect(block).not.toContain(nom);
    }
  });

  it("liste les 214 noms de monstres", () => {
    expect(block).toContain(String(NB_MONSTRES));
    for (const name of NAMES) {
      expect(block).toContain(`- ${name}`);
    }
  });

  it("ordonne preambule, puis regles, puis index des monstres", () => {
    const iPreamble = block.indexOf(PREAMBLE);
    const iRegles = block.indexOf("Tableau des difficultés");
    const iIndex = block.indexOf("# Bestiaire — index des creatures");
    expect(iPreamble).toBeGreaterThanOrEqual(0);
    expect(iPreamble).toBeLessThan(iRegles);
    expect(iRegles).toBeLessThan(iIndex);
  });
});
