// Section "campagne" du prompt d'Isilwen : compagnons, codex, journal de bord,
// titres des pages partagees et notes privees du joueur. Tout est pur ici pour
// rester testable sans base ni Express ; index.ts ne fait que charger les donnees.

export type PartyMember = {
  characterId: number;
  name: string;
  people: string;
  profile: string;
  culturalPath: string | null;
  portraitImageId: number | null;
};

export type CodexEntry = { type: string; name: string; description: string };

export type PartyContext = {
  campaignName: string;
  gmUserId: number;
  members: PartyMember[];
  codex: CodexEntry[];
};

export type JournalContext = {
  content: string;
  editedBy: string | null;
  pages: Array<{ id: number; title: string }>;
  /** Notes texte du joueur, de la plus ancienne a la plus recente. */
  notes: Array<{ title: string; content: string }>;
};

export const CAMPAIGN_CONTEXT_MAX_CHARS = 60000;

function omittedLine(count: number): string {
  return `[…${count} caractères omis]`;
}

/**
 * Garde-fou de taille sur journal + codex + notes (blocs deja rendus en texte).
 * Ordre de coupe : les notes d'abord (les plus anciennes en premier, une par une),
 * puis le debut du journal (on garde la fin, c'est le plus recent). Le codex n'est
 * jamais coupe. Chaque coupe laisse une ligne "[…N caractères omis]".
 */
export function trimCampaignContext(
  { journal, codex, notes }: { journal: string; codex: string; notes: string[] },
  maxChars = CAMPAIGN_CONTEXT_MAX_CHARS,
): { journal: string; codex: string; notes: string[] } {
  let total = journal.length + codex.length + notes.reduce((sum, n) => sum + n.length, 0);
  if (total <= maxChars) return { journal, codex, notes };

  const keptNotes = [...notes];
  let omittedNotes = 0;
  while (total > maxChars && keptNotes.length > 0) {
    const dropped = keptNotes.shift()!;
    omittedNotes += dropped.length;
    total -= dropped.length;
  }
  if (omittedNotes > 0) keptNotes.unshift(omittedLine(omittedNotes));

  let keptJournal = journal;
  if (total > maxChars) {
    const excess = total - maxChars;
    keptJournal = `${omittedLine(excess)}\n${journal.slice(excess)}`;
  }

  return { journal: keptJournal, codex, notes: keptNotes };
}

function renderCompanions(party: PartyContext, activeCharId: number | null): string {
  // Le personnage actif est deja dans characterSection, on ne le repete pas.
  const others = party.members.filter((m) => m.characterId !== activeCharId);
  if (others.length === 0) return "";

  const lines = others.map((m) => {
    const parts = [m.name];
    if (m.people) parts.push(m.people);
    if (m.profile) parts.push(`profil ${m.profile}`);
    if (m.culturalPath) parts.push(`voie culturelle : ${m.culturalPath}`);
    return `- ${parts.join(", ")}`;
  });
  return (
    "\n\n### Compagnons de campagne\n\n" +
    lines.join("\n") +
    "\n\nPour consulter la fiche complète d'un compagnon (stats, voies, compétences, portrait), utilise l'outil get_character avec son prénom."
  );
}

function renderCodex(codex: CodexEntry[]): string {
  if (codex.length === 0) return "Le codex est vide.";
  return codex.map((e) => `- [${e.type}] ${e.name} — ${e.description}`).join("\n");
}

function renderNote(note: { title: string; content: string }): string {
  return `### ${note.title || "Sans titre"}\n${note.content}`;
}

/**
 * Construit la section campagne, inseree apres la fiche du personnage.
 * Le titre "## Campagne : <nom>" est toujours present quand une campagne est
 * active, meme sans compagnon. Sans campagne active, seuls le journal, les
 * pages et les notes (non scopes par campagne en base) sont rendus.
 */
export function buildCampaignSection(
  party: PartyContext | null,
  activeCharId: number | null,
  journal: JournalContext,
  maxChars = CAMPAIGN_CONTEXT_MAX_CHARS,
): string {
  const trimmed = trimCampaignContext(
    {
      journal: journal.content,
      codex: party ? renderCodex(party.codex) : "",
      notes: journal.notes.map(renderNote),
    },
    maxChars,
  );

  let out = "";
  if (party) {
    out += `\n\n## Campagne : ${party.campaignName}`;
    out += renderCompanions(party, activeCharId);
    out += `\n\n## Codex de la campagne\n\n${trimmed.codex}`;
  }

  out += "\n\n## Journal de bord\n";
  if (journal.editedBy) out += `Dernière modification par : ${journal.editedBy}\n`;
  out += "\n" + (trimmed.journal || "Le journal de bord est vide.");

  out += "\n\n## Pages partagées\n\n";
  if (journal.pages.length === 0) {
    out += "Aucune page partagée.";
  } else {
    out += journal.pages.map((p) => `- (${p.id}) ${p.title}`).join("\n");
    out += "\n\nPour lire le contenu d'une page, utilise l'outil get_page avec son id.";
  }

  out += "\n\n## Tes notes privées\n\n";
  out += trimmed.notes.length === 0 ? "Aucune note." : trimmed.notes.join("\n\n");

  return out;
}
