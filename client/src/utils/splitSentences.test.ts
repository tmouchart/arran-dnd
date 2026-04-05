import { describe, it, expect } from "vitest";
import { splitSentences } from "./splitSentences";

describe("splitSentences", () => {
  it("splits simple sentences", () => {
    expect(
      splitSentences("Bonjour aventurier. Comment allez-vous?")
    ).toEqual(["Bonjour aventurier.", "Comment allez-vous?"]);
  });

  it("handles exclamation and question marks", () => {
    expect(
      splitSentences("Attention au dragon! Il est dangereux. Fuyez!")
    ).toEqual(["Attention au dragon!", "Il est dangereux. Fuyez!"]);
  });

  it("preserves abbreviations", () => {
    expect(
      splitSentences("M. Dupont est arrivé. Il a salué Mme. Martin.")
    ).toEqual(["M. Dupont est arrivé.", "Il a salué Mme. Martin."]);
  });

  it("handles ellipsis", () => {
    expect(
      splitSentences("Le silence pesait... Puis un cri retentit.")
    ).toEqual(["Le silence pesait...", "Puis un cri retentit."]);
  });

  it("merges short segments", () => {
    // "Oui." is too short, should merge with next
    expect(splitSentences("Oui. Il est parti. La nuit tombait sur la forêt.")).toEqual([
      "Oui. Il est parti.",
      "La nuit tombait sur la forêt.",
    ]);
  });

  it("returns single segment for short text", () => {
    expect(splitSentences("Bonjour!")).toEqual(["Bonjour!"]);
  });

  it("returns empty array for empty input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });

  it("handles text with no sentence boundaries", () => {
    expect(splitSentences("Un long texte sans point final")).toEqual([
      "Un long texte sans point final",
    ]);
  });

  it("handles unicode ellipsis character", () => {
    expect(
      splitSentences("Le vent soufflait\u2026 Les arbres tremblaient.")
    ).toEqual(["Le vent soufflait\u2026", "Les arbres tremblaient."]);
  });
});
