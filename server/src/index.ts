import "./loadEnv.js";
import { getDatabaseUrl } from "./db/databaseUrl.js";
import { runMigrations } from "./db/runMigrations.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import authRouter from "./routes/auth.js";
import charactersRouter from "./routes/characters.js";
import sessionsRouter from "./routes/sessions.js";
import journalRouter from "./routes/journal.js";
import campaignsRouter from "./routes/campaigns.js";
import combatsRouter from "./routes/combats.js";
import ttsRouter from "./routes/tts.js";
import { requireAuth, type AuthRequest } from "./auth/middleware.js";
import { loadCoreIndex, loadTopic } from "./knowledge/loadKnowledge.js";
import { CLIENT_DIST, REPO_ROOT } from "./paths.js";
import {
  anthropicTool,
  geminiTool,
  TOPIC_NAMES,
  type TopicName,
} from "./knowledge/tools.js";
import { and, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { campaigns, campaignMembers, characters, generatedImages, journalCompagnie, journalPages, users } from "./db/schema.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.use("/api/auth", authRouter);
app.use("/api/characters", charactersRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/journal", journalRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/campaigns", combatsRouter);
app.use("/api/tts", ttsRouter);

// Serve generated images from database (auth-protected, owner only)
app.get("/api/images/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = (req as AuthRequest).userId;
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid image ID" });
    return;
  }
  const [row] = await db
    .select({ data: generatedImages.data, mimeType: generatedImages.mimeType, userId: generatedImages.userId })
    .from(generatedImages)
    .where(and(eq(generatedImages.id, id), eq(generatedImages.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const buffer = Buffer.from(row.data, "base64");
  res.setHeader("Content-Type", row.mimeType);
  res.setHeader("Cache-Control", "private, max-age=604800, immutable");
  res.setHeader("Content-Length", buffer.length);
  res.end(buffer);
});

// List generated images for current user (metadata only, no binary data)
app.get("/api/images", requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const rows = await db
    .select({
      id: generatedImages.id,
      prompt: generatedImages.prompt,
      mimeType: generatedImages.mimeType,
      createdAt: generatedImages.createdAt,
    })
    .from(generatedImages)
    .where(eq(generatedImages.userId, userId))
    .orderBy(generatedImages.createdAt);
  res.json(rows.map((r) => ({
    id: r.id,
    url: `/api/images/${r.id}`,
    prompt: r.prompt,
    mimeType: r.mimeType,
    createdAt: r.createdAt,
  })));
});

const AI_PROVIDER = process.env.AI_PROVIDER ?? "gemini";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
/** Available image generation models (best first). Override with GEMINI_IMAGE_MODEL env var. */
const GEMINI_IMAGE_MODELS = [
  "gemini-3.1-flash-image-preview", // Nano Banana 2 — best quality/price, up to 4K
  "nano-banana-pro-preview",        // Gemini 3 Pro Image — highest quality, ~$0.13/img
  "gemini-3-pro-image-preview",     // Gemini 3 Pro Image (alias)
  "gemini-2.5-flash-image",         // Nano Banana 1 — deprecated oct 2026
] as const;
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? GEMINI_IMAGE_MODELS[0];

// Load style reference image for image generation (mood board collage)
const STYLE_REF_PATH = join(REPO_ROOT, "example-images", "style-reference.jpg");
const styleRefBase64 = existsSync(STYLE_REF_PATH)
  ? readFileSync(STYLE_REF_PATH).toString("base64")
  : null;
if (styleRefBase64) console.log("[image] Style reference loaded from style-reference.jpg");

const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS ?? 8192);
const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const SYSTEM_PREAMBLE = `Tu incarnes Isilwen du Miroir Astral, une Elfe Bleue divinatrice et mystique du monde des Terres d'Arran, utilisant le moteur Chroniques Oubliées.
Tu t'adresses aux joueurs et au meneur en français, toujours en restant en personnage.

🎭 Style de roleplay (intégré et constant) :
- Reste en personnage du début à la fin, sans rupture de ton ni "mode d'emploi".
- Fonds naturellement le roleplay avec les règles : ton immersif, explications précises, transitions fluides.
- Taquinerie bienvenue, toujours bienveillante — jamais agressive ni humiliante.
- Si un personnage actif est fourni dans le contexte, adresse-toi à lui par son prénom et adapte tes conseils à sa race, son profil, son histoire (si fournie), ses armes et capacités, et son niveau.

⚡ Concision avant tout :
- Réponds de façon directe et concise. Va à l'essentiel sans tourner autour du pot.
- Utilise les émojis quand ils ajoutent de la clarté ou de la lisibilité (listes, catégories, points importants).
- Évite les longues introductions, les répétitions et les formules creuses. Une bonne réponse est courte et utile.
- Structure : info utile d'abord, couleur narrative ensuite — jamais l'inverse.

📖 Rigueur règles :
- Les extraits proviennent d'une base interne (knowledge/) : ce n'est PAS une copie complète du livre.
- Si une règle manque ou est incertaine, dis-le en une phrase, propose de vérifier le livre officiel, puis donne une alternative prudente.
- N'invente pas de chiffres (bonus, coûts, DD) : si l'info n'est pas dans les extraits, ne la fabrique pas.
- Tu as accès à un outil load_knowledge pour charger des règles détaillées. Utilise-le dès qu'une question porte sur un sujet spécifique (races, combat, magie, voies, équipement, création de personnage, monde, histoire et lore des Terres d'Arran...).

✏️ Modification de fiche (edit_character) :
- Tu peux modifier les statistiques du personnage (FOR, DEX, CON, INT, SAG, CHA, niveau, PV max, PM max, défense) avec l'outil edit_character.
- RÈGLE ABSOLUE : avant d'appeler edit_character, annonce EXACTEMENT ce que tu vas changer et attends la confirmation explicite du joueur ("oui", "ok", "vas-y", "d'accord"...).
  Exemple : "Je peux passer ta FOR de 10 à 12 — veux-tu que je le fasse ?"
- N'appelle JAMAIS edit_character si l'utilisateur n'a pas confirmé dans son dernier message.
- Après modification, confirme brièvement en restant en personnage.

🐉 Bestiaire (règle stricte) :
- Tu ne dois JAMAIS révéler de données chiffrées sur les monstres aux joueurs : pas de PV, DEF, NC, bonus d'attaque, DM, caractéristiques (FOR, DEX, etc.), initiative, ou réduction de dégâts.
- Tu peux uniquement partager : le nom du monstre, sa taille, sa description narrative, et le nom de ses capacités (sans les détails mécaniques).
- Si un joueur demande les stats d'un monstre, refuse poliment en restant en personnage : "Les mystères de cette créature ne se révèlent qu'au combat..."

↩️ Annulation (undo) :
- Si un previousCharacter est présent dans le contexte du personnage, cela signifie qu'une modification a été faite lors de cette conversation.
- Si l'utilisateur demande d'annuler ("annule", "undo", "remets comme avant"...), demande confirmation puis appelle edit_character avec les valeurs du previousCharacter.
- Ne propose l'annulation que si previousCharacter est présent dans le contexte.

📜 Journal de compagnie (outils get_journal, get_page) :
- Tu as accès au journal de la compagnie et aux pages wiki créées par les joueurs.
- get_journal retourne le journal de bord ET la liste des pages wiki (id, titre, date). C'est ton point d'entrée. Les pages sont triées par date.
- get_page retourne le contenu complet d'une page wiki par son id. Utilise-le après get_journal si une page semble pertinente.
- PROACTIVITÉ : dès qu'un joueur pose une question liée à leurs aventures, sessions passées, PNJ rencontrés, lieux visités, événements vécus, ou tout sujet narratif de la campagne → appelle immédiatement get_journal SANS demander confirmation. Va chercher l'information d'abord, réponds ensuite.
- RÉSUMÉ D'AVENTURES : si on te demande de raconter ou résumer les aventures, appelle get_journal puis enchaîne avec get_page sur les pages les plus récentes pour construire un récit complet. Ne te limite pas au journal — lis aussi les pages.
- Ne demande pas "veux-tu que je consulte le journal ?" — fais-le directement.

🎨 Illustration (generate_image) :
- Tu peux générer des illustrations (scènes, portraits, cartes, objets) avec l'outil generate_image.
- Utilise-le quand le joueur demande une image, ou quand une description de scène ou de personnage bénéficierait d'une illustration.
- Le prompt DOIT être en anglais, détaillé, style "medieval high fantasy, painterly, warm tones".
- IMPORTANT : l'image générée doit TOUJOURS être une illustration plein cadre. Jamais une page de livre, jamais un cadre blanc autour, jamais un format "photo d'un livre". Ajoute "full frame illustration, no borders, no book page, no white margins" à chaque prompt.
- Inclus toujours le contexte du monde d'Arran dans le prompt (elfes, nains, cristaux, forêts anciennes, etc.).
- Après génération, continue ta réponse normalement — l'image s'affiche automatiquement dans le chat.
- N'utilise PAS cet outil pour les questions de règles, de mécanique ou de statistiques.
- Limite : maximum 1 image par réponse sauf demande explicite du joueur.

👥 Compagnons de campagne (get_character) :
- La liste de tes compagnons de campagne est dans le contexte ci-dessous.
- get_character te donne la fiche complète d'un compagnon (profil, stats, voies, compétences, portrait).
- RÈGLE ABSOLUE : avant de générer une image représentant un ou plusieurs personnages joueurs, appelle TOUJOURS get_character sur chaque personnage concerné DANS LE MÊME MESSAGE, même si tu l'as déjà appelé dans un message précédent. Le portrait image n'est transmis au générateur que s'il est récupéré dans le même tour. Ne génère JAMAIS une image d'un personnage sans avoir d'abord consulté sa fiche dans ce même tour.
- RÈGLE ABSOLUE : quand tu as besoin de connaître l'apparence physique d'un compagnon (pour le décrire, générer une image, ou toute autre raison), appelle get_character pour consulter son portrait. Ne demande JAMAIS au joueur de décrire un compagnon dont tu peux consulter la fiche.
- Utilise get_character de façon proactive quand un joueur pose une question sur un compagnon.`;

type ChatMessage = { role: "user" | "assistant"; content: string };
type SseEvent = "delta" | "done" | "error" | "tool_use" | "character_updated" | "image";

function writeSse(res: express.Response, event: SseEvent, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const EDITABLE_FIELDS = new Set([
  "str", "dex", "con", "int", "wis", "cha", "level", "hpMax", "mpMax", "defense",
]);
type EditableField = "str" | "dex" | "con" | "int" | "wis" | "cha" | "level" | "hpMax" | "mpMax" | "defense";

function sanitizeChanges(raw: Record<string, unknown>): Partial<Record<EditableField, number>> {
  const out: Partial<Record<EditableField, number>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (
      EDITABLE_FIELDS.has(k) &&
      typeof v === "number" &&
      Number.isInteger(v) &&
      v >= 0 &&
      v <= 9999
    ) {
      out[k as EditableField] = v;
    }
  }
  return out;
}

function logTokens(
  label: string,
  usage: { input?: number; output?: number; total?: number }
): void {
  const parts: string[] = [];
  if (usage.input != null) parts.push(`in=${usage.input}`);
  if (usage.output != null) parts.push(`out=${usage.output}`);
  if (usage.total != null) parts.push(`total=${usage.total}`);
  console.log(`[tokens] ${label}: ${parts.join(" ")}`);
}


type CharacterPayload = Record<string, unknown>;

function buildCharacterSection(c: CharacterPayload): string {
  const name = c.name ?? "Inconnu";
  const people = c.people ?? "";
  const profile = c.profile ?? "";
  const level = c.level ?? 1;
  const hpMax = c.hpMax ?? "?";
  const mpMax = c.mpMax ?? "?";
  const hpCurrent = c.hpCurrent;
  const mpCurrent = c.mpCurrent;
  const defense = c.defense ?? "?";
  const initiativeBonus = c.initiativeBonus;
  const histoire = typeof c.histoire === "string" ? c.histoire.trim() : "";
  const mysticTalent =
    typeof c.mysticTalent === "string" && c.mysticTalent.trim() !== ""
      ? c.mysticTalent.trim()
      : "";

  const abilities = (c.abilities as Record<string, number> | undefined) ?? {};
  const mod = (score: number | string) =>
    typeof score === "number" ? Math.floor((score - 10) / 2) : "?";
  const fmtMod = (score: number | string) => {
    const m = mod(score);
    return typeof m === "number" ? (m >= 0 ? `+${m}` : `${m}`) : "?";
  };
  const str = abilities.strength ?? "?";
  const dex = abilities.dexterity ?? "?";
  const con = abilities.constitution ?? "?";
  const int_ = abilities.intelligence ?? "?";
  const wis = abilities.wisdom ?? "?";
  const cha = abilities.charisma ?? "?";
  const paths = (c.paths as Array<{ name: string; rank: number }> | undefined) ?? [];
  const skills = (c.skills as Array<{ name: string; rank: number }> | undefined) ?? [];
  const martialFormations = Array.isArray(c.martialFormations)
    ? (c.martialFormations as string[])
    : [];
  const weapons =
    (c.weapons as
      | Array<{
          name: string;
          attackType?: string;
          damageDice?: string;
          damageAbility?: string | null;
          martialFamily?: string;
          rangeMeters?: number | null;
          notes?: string;
        }>
      | undefined) ?? [];
  const items =
    (c.items as Array<{ name: string; description?: string; quantity: number }> | undefined) ?? [];
  const goldCoins = typeof c.goldCoins === "number" ? c.goldCoins : 0;
  const silverCoins = typeof c.silverCoins === "number" ? c.silverCoins : 0;
  const copperCoins = typeof c.copperCoins === "number" ? c.copperCoins : 0;

  const pathsStr = paths.length > 0
    ? paths.map((p) => `${p.name} (rang ${p.rank})`).join(", ")
    : "aucune";
  const skillsStr = skills.length > 0
    ? skills.map((s) => `${s.name} (rang ${s.rank})`).join(", ")
    : "aucune";

  const pvPmLine =
    typeof hpCurrent === "number" && typeof mpCurrent === "number"
      ? `PV ${hpCurrent}/${hpMax} | PM ${mpCurrent}/${mpMax}`
      : `PV max ${hpMax} | PM max ${mpMax}`;

  const initiativeLine =
    typeof initiativeBonus === "number"
      ? `Initiative (score) ${initiativeBonus}`
      : "";

  const martialLine =
    martialFormations.length > 0
      ? `Formations martiales (catégories d'armes) : ${martialFormations.join(", ")}`
      : "";

  const mysticLine = mysticTalent
    ? `Talent mystique (identifiant) : ${mysticTalent}`
    : "";

  const weaponsStr =
    weapons.length > 0
      ? weapons
          .map((w) => {
            const parts = [w.name];
            if (w.damageDice) parts.push(`dégâts ${w.damageDice}`);
            if (w.attackType) parts.push(w.attackType);
            if (w.damageAbility) parts.push(`Mod. ${w.damageAbility}`);
            if (w.martialFamily) parts.push(`famille ${w.martialFamily}`);
            if (w.rangeMeters != null) parts.push(`portée ${w.rangeMeters} m`);
            if (w.notes?.trim()) parts.push(`note: ${w.notes.trim()}`);
            return parts.join(" — ");
          })
          .join("\n")
      : "";

  const histoireBlock = histoire
    ? `\n\n### Histoire et contexte (fiche joueur)\n\n${histoire}`
    : "";

  const moneyLine = (goldCoins > 0 || silverCoins > 0 || copperCoins > 0)
    ? `Argent : ${goldCoins} po / ${silverCoins} pa / ${copperCoins} pc`
    : "";

  const itemsStr = items.length > 0
    ? items.map((it) => {
        const desc = it.description?.trim() ? ` (${it.description.trim()})` : "";
        return `- ${it.name}${desc} ×${it.quantity}`;
      }).join("\n")
    : "";

  const extraBlocks = [
    initiativeLine,
    martialLine,
    mysticLine,
    weaponsStr ? `Armes :\n${weaponsStr}` : "",
    moneyLine,
    itemsStr ? `Inventaire :\n${itemsStr}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `## Personnage actif

Tu t'adresses à **${name}**${people ? `, ${people}` : ""}${profile ? `, profil ${profile}` : ""}, niveau ${level}.
Stats : FOR ${str} (${fmtMod(str)}) / DEX ${dex} (${fmtMod(dex)}) / CON ${con} (${fmtMod(con)}) / INT ${int_} (${fmtMod(int_)}) / SAG ${wis} (${fmtMod(wis)}) / CHA ${cha} (${fmtMod(cha)})
${pvPmLine} | Défense ${defense}${extraBlocks ? `\n${extraBlocks}` : ""}
Voies : ${pathsStr}
Compétences : ${skillsStr}${histoireBlock}

👤 Adresse-toi toujours à ce personnage par son prénom. Adapte tes réponses à sa race, son profil, son histoire (si fournie), ses armes et ses capacités.`;
}

type GeminiPart = Record<string, unknown>;
type GeminiContent = { role: string; parts: GeminiPart[] };

function messagestoGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, topics: TOPIC_NAMES });
});

function buildPreviousCharacterSection(prev: CharacterPayload): string {
  const FIELD_LABELS: Record<string, string> = {
    str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA",
    level: "Niveau", hpMax: "PV max", mpMax: "PM max", defense: "Défense",
  };
  const parts = Object.entries(prev)
    .filter(([k, v]) => EDITABLE_FIELDS.has(k) && typeof v === "number")
    .map(([k, v]) => `${FIELD_LABELS[k] ?? k}=${v}`);
  if (parts.length === 0) return "";
  return `\n\n⚠️ Modification récente (annulable) :\nValeurs avant modification — ${parts.join(", ")}`;
}

// ── Party context for campaign-aware chat ────────────────────────────────────

type PartyMember = {
  characterId: number;
  name: string;
  people: string;
  profile: string;
  culturalPath: string | null;
  portraitImageId: number | null;
};

type PartyContext = {
  campaignName: string;
  members: PartyMember[];
};

async function fetchPartyContext(userId: number): Promise<PartyContext | null> {
  const [user] = await db
    .select({ activeCampaignId: users.activeCampaignId })
    .from(users)
    .where(eq(users.id, userId));
  if (!user?.activeCampaignId) return null;

  const [campaign] = await db
    .select({ name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.id, user.activeCampaignId));
  if (!campaign) return null;

  const rows = await db
    .select({
      characterId: characters.id,
      name: characters.name,
      people: characters.people,
      profile: characters.profile,
      paths: characters.paths,
      portraitImageId: characters.portraitImageId,
    })
    .from(campaignMembers)
    .innerJoin(characters, eq(characters.id, campaignMembers.characterId))
    .where(eq(campaignMembers.campaignId, user.activeCampaignId));

  return {
    campaignName: campaign.name,
    members: rows.map((r) => {
      const paths = (r.paths as Array<{ name: string; rank: number; kind?: string }>) ?? [];
      const cultural = paths.find((p) => p.kind === "culturelle");
      return {
        characterId: r.characterId,
        name: r.name,
        people: r.people,
        profile: r.profile,
        culturalPath: cultural ? `${cultural.name} (rang ${cultural.rank})` : null,
        portraitImageId: r.portraitImageId,
      };
    }),
  };
}

function buildPartySection(party: PartyContext, activeCharId: number | null): string {
  // Exclude the active character (already in characterSection)
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
    `\n\n## Compagnons de campagne (${party.campaignName})\n\n` +
    lines.join("\n") +
    "\n\nPour consulter la fiche complète d'un compagnon (stats, voies, compétences, portrait), utilise l'outil get_character avec son prénom."
  );
}

async function charNameByUserId(userId: number | null): Promise<string | null> {
  if (userId == null) return null;
  const [char] = await db
    .select({ name: characters.name })
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.isActive, true)))
    .limit(1);
  return char?.name ?? null;
}

app.post("/api/chat", requireAuth, async (req, res) => {
  try {
    const chatUser = (req as AuthRequest).username;
    const chatUserId = (req as AuthRequest).userId;
    const body = req.body as { messages?: ChatMessage[]; character?: CharacterPayload; previousCharacter?: CharacterPayload };
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages[] required" });
      return;
    }

    const character = body.character ?? null;
    const previousCharacter = body.previousCharacter ?? null;
    const index = await loadCoreIndex();
    const characterSection = character ? `\n\n${buildCharacterSection(character)}` : "";
    const previousSection = character && previousCharacter ? buildPreviousCharacterSection(previousCharacter) : "";
    const party = await fetchPartyContext(chatUserId);
    const activeCharId = character ? Number(character.id) : null;
    const partySection = party ? buildPartySection(party, activeCharId) : "";
    const system = `${SYSTEM_PREAMBLE}${characterSection}${partySection}${previousSection}\n\n## Index des sujets disponibles\n\n${index}`;

    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    // ── GEMINI ───────────────────────────────────────────────────────────────
    if (AI_PROVIDER === "gemini") {
      if (!geminiClient) {
        writeSse(res, "error", {
          error: "GEMINI_API_KEY manquante. Ajoute-la dans server/.env.",
        });
        res.end();
        return;
      }

      let contents: GeminiContent[] = messagestoGeminiContents(messages);
      let calledTopic: TopicName | null = null;
      let geminiTotalTokens = 0;

      const MAX_TOOL_TURNS = 5;

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const allParts: GeminiPart[] = [];
        let lastUsage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;

        const stream = await geminiClient.models.generateContentStream({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: system,
            tools: [geminiTool],
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        for await (const chunk of stream) {
          if (closed) break;
          if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
          const parts = (chunk.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
          allParts.push(...parts);
          const text = typeof chunk.text === "string" ? chunk.text : "";
          if (text) writeSse(res, "delta", { text });
        }

        logTokens(`gemini turn${turn + 1}`, {
          input: lastUsage?.promptTokenCount,
          output: lastUsage?.candidatesTokenCount,
          total: lastUsage?.totalTokenCount,
        });
        geminiTotalTokens += lastUsage?.totalTokenCount ?? 0;

        // Check for tool call
        const funcCall = allParts.find((p) => p.functionCall != null);
        if (!funcCall || closed) {
          if (!funcCall) console.log(`[chat] No tool call on turn ${turn + 1} — done (gemini)`);
          break;
        }

        const funcName = (funcCall.functionCall as { name?: string }).name ?? "";
        const funcArgs = (funcCall.functionCall as { args?: Record<string, unknown> }).args ?? {};
        console.log(`[chat] Tool call on turn ${turn + 1}: ${funcName} (gemini)`);

        // Execute tool and get result
        let toolResult: string | null = null;

        if (funcName === "load_knowledge") {
          const rawTopic = (funcArgs.topic as string) ?? "";
          if (!(TOPIC_NAMES as readonly string[]).includes(rawTopic)) {
            console.error(`[knowledge] load_knowledge ignored unknown topic: "${rawTopic}"`);
            writeSse(res, "error", {
              error: "Le serveur ne reconnaît pas ce sujet de règles. Recharge la page et réessaie.",
            });
            res.end();
            return;
          }
          calledTopic = rawTopic as TopicName;
          writeSse(res, "tool_use", { tool: "load_knowledge", topic: calledTopic });
          try {
            toolResult = await loadTopic(calledTopic);
            console.log(`[knowledge] Loaded topic: "${calledTopic}"`);
          } catch {
            console.error(`[knowledge] Failed to load topic: "${calledTopic}"`);
            writeSse(res, "error", { error: "Impossible de charger le sujet demandé." });
            res.end();
            return;
          }
        } else if (funcName === "edit_character") {
          const rawChanges = (funcArgs.changes as Record<string, unknown>) ?? {};
          const safeChanges = sanitizeChanges(rawChanges);

          if (Object.keys(safeChanges).length === 0) {
            writeSse(res, "error", { error: "La fiche n'a pas pu être modifiée : aucun champ valide." });
            res.end();
            return;
          }

          const charId = Number(character?.id);
          if (!Number.isFinite(charId) || charId <= 0) {
            writeSse(res, "error", { error: "Identifiant de personnage invalide." });
            res.end();
            return;
          }

          const [oldRow] = await db.select().from(characters).where(eq(characters.id, charId));
          if (!oldRow) {
            writeSse(res, "error", { error: "Personnage introuvable." });
            res.end();
            return;
          }

          const [updatedRow] = await db
            .update(characters)
            .set({ ...safeChanges, updatedAt: new Date() })
            .where(eq(characters.id, charId))
            .returning();

          console.log(`[edit_character] Updated character ${charId}:`, safeChanges);
          writeSse(res, "character_updated", { character: updatedRow, previousCharacter: oldRow });
          toolResult = `Modification appliquée : ${JSON.stringify(safeChanges)}`;
        } else if (funcName === "get_journal") {
          const [row] = await db.select().from(journalCompagnie).where(eq(journalCompagnie.id, 1));
          const journalContent = row?.content ?? "";
          const journalEditedBy = await charNameByUserId(row?.updatedByUserId ?? null);
          const pages = await db
            .select({ id: journalPages.id, title: journalPages.title, updatedAt: journalPages.updatedAt, updatedByUserId: journalPages.updatedByUserId })
            .from(journalPages)
            .orderBy(journalPages.updatedAt);

          let result = "## Journal de bord\n";
          if (journalEditedBy) result += `Dernière modification par : ${journalEditedBy}\n`;
          result += "\n";
          if (journalContent) {
            result += journalContent.length > 8000 ? journalContent.slice(0, 8000) + "\n\n[…contenu tronqué]" : journalContent;
          } else {
            result += "Le journal de compagnie est vide.";
          }
          result += "\n\n## Pages wiki disponibles\n\n";
          if (pages.length === 0) {
            result += "Aucune page wiki n'a été créée.";
          } else {
            const pageLines = await Promise.all(pages.map(async (p) => {
              const editedBy = await charNameByUserId(p.updatedByUserId);
              const byStr = editedBy ? ` — par ${editedBy}` : "";
              return `- [${p.id}] ${p.title} (${p.updatedAt.toLocaleDateString("fr-FR")}${byStr})`;
            }));
            result += pageLines.join("\n");
          }

          toolResult = result;
          console.log(`[journal] Loaded company journal (${journalContent.length} chars) + ${pages.length} pages`);
          console.log(`[journal] Journal content:\n${toolResult}`);
          writeSse(res, "tool_use", { tool: "get_journal", label: "Lecture du journal" });
        } else if (funcName === "get_page") {
          const pageId = Number(funcArgs.id);
          if (!Number.isFinite(pageId) || pageId <= 0) {
            toolResult = "Identifiant de page invalide.";
          } else {
            const [page] = await db.select().from(journalPages).where(eq(journalPages.id, pageId));
            if (!page) {
              toolResult = `Aucune page trouvée avec l'id ${pageId}.`;
            } else {
              const editedBy = await charNameByUserId(page.updatedByUserId);
              const content = page.content ?? "";
              const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n\n[…contenu tronqué]" : content;
              const byLine = editedBy ? `\nDernière modification par : ${editedBy}\n` : "";
              toolResult = `# ${page.title}${byLine}\n${truncated}`;
            }
            console.log(`[journal] Loaded page ${funcArgs.id}`);
            console.log(`[journal] Page content:\n${toolResult}`);
            writeSse(res, "tool_use", { tool: "get_page", label: `Lecture de la page : ${page?.title ?? pageId}` });
          }
        } else if (funcName === "generate_image") {
          const imagePrompt = (funcArgs.prompt as string) ?? "";
          writeSse(res, "tool_use", { tool: "generate_image", label: "Génération d'une illustration…" });

          try {
            // Load character portrait if available (to use as visual reference)
            let portraitBase64: string | null = null;
            let portraitMimeType: string | null = null;
            const portraitId = character ? (character as Record<string, unknown>).portraitImageId : null;
            if (typeof portraitId === "number" && portraitId > 0) {
              const [portraitRow] = await db
                .select({ data: generatedImages.data, mimeType: generatedImages.mimeType })
                .from(generatedImages)
                .where(eq(generatedImages.id, portraitId));
              if (portraitRow) {
                portraitBase64 = portraitRow.data;
                portraitMimeType = portraitRow.mimeType;
              }
            }

            const imageParts: Array<Record<string, unknown>> = [];
            if (styleRefBase64) {
              imageParts.push({
                inlineData: { mimeType: "image/jpeg", data: styleRefBase64 },
              });
            }
            if (portraitBase64 && portraitMimeType) {
              imageParts.push({
                inlineData: { mimeType: portraitMimeType, data: portraitBase64 },
              });
              imageParts.push({
                text: (styleRefBase64
                  ? "Generate a full-frame illustration in the exact same artistic style as the first reference image (European fantasy comic art). Match the color palette, ink linework, and painterly rendering. The second image is the character's portrait — use it as a visual reference for the character's appearance (face, hair, build, clothing). IMPORTANT: full bleed illustration filling the entire frame, no borders, no book pages, no white margins, no photo of a page. Subject: "
                  : "The attached image is the character's portrait — use it as a visual reference for the character's appearance (face, hair, build, clothing). IMPORTANT: full bleed illustration filling the entire frame, no borders, no book pages, no white margins. Subject: "
                ) + imagePrompt,
              });
            } else if (styleRefBase64) {
              imageParts.push({
                text: "Generate a full-frame illustration in the exact same artistic style as this reference (European fantasy comic art). Match the color palette, ink linework, and painterly rendering. IMPORTANT: full bleed illustration filling the entire frame, no borders, no book pages, no white margins, no photo of a page. Subject: " + imagePrompt,
              });
            } else {
              imageParts.push({ text: imagePrompt });
            }

            const imageResponse = await geminiClient!.models.generateContent({
              model: GEMINI_IMAGE_MODEL,
              contents: [{ role: "user", parts: imageParts }],
              config: {
                responseModalities: ["Text", "Image"],
              },
            });

            const parts = imageResponse.candidates?.[0]?.content?.parts ?? [];
            const imagePart = parts.find(
              (p) => (p.inlineData as { mimeType?: string } | undefined)?.mimeType?.startsWith("image/")
            );

            const inlineData = imagePart?.inlineData as
              | { mimeType: string; data: string }
              | undefined;

            if (inlineData) {
              const [inserted] = await db
                .insert(generatedImages)
                .values({
                  userId: chatUserId,
                  data: inlineData.data,
                  mimeType: inlineData.mimeType,
                  prompt: imagePrompt,
                })
                .returning({ id: generatedImages.id });

              const imageUrl = `/api/images/${inserted.id}`;
              writeSse(res, "image", { url: imageUrl, alt: imagePrompt });
              toolResult = "Image générée avec succès. L'image est affichée dans le chat. Continue ta réponse normalement sans re-décrire l'image en détail.";
              console.log(`[generate_image] Saved image ${inserted.id} for prompt: "${imagePrompt.slice(0, 80)}…"`);
            } else {
              toolResult = "La génération d'image a échoué — aucune image retournée par le modèle.";
              console.error("[generate_image] No image part in response");
            }
          } catch (err) {
            console.error("[generate_image] Error:", err);
            toolResult = "Erreur lors de la génération de l'image. Réessaie plus tard.";
          }
        } else if (funcName === "get_character") {
          const targetName = (funcArgs.name as string) ?? "";
          writeSse(res, "tool_use", { tool: "get_character", label: `Consultation de ${targetName}…` });

          let portraitData: { data: string; mimeType: string } | null = null;

          if (!party) {
            toolResult = "Aucune campagne active — impossible de consulter les compagnons.";
          } else {
            const match = party.members.find((m) =>
              m.name.toLowerCase().includes(targetName.toLowerCase())
            );
            if (!match) {
              toolResult = `Aucun compagnon nommé "${targetName}" dans la campagne.`;
            } else {
              const [char] = await db.select().from(characters).where(eq(characters.id, match.characterId));
              if (!char) {
                toolResult = "Personnage introuvable en base de données.";
              } else {
                // Build character section without inventory
                const charPayload: CharacterPayload = {
                  ...char,
                  items: [],
                  goldCoins: 0,
                  silverCoins: 0,
                  copperCoins: 0,
                  abilities: {
                    strength: char.str,
                    dexterity: char.dex,
                    constitution: char.con,
                    intelligence: char.int,
                    wisdom: char.wis,
                    charisma: char.cha,
                  },
                };
                toolResult = buildCharacterSection(charPayload);
                console.log(`[get_character] Loaded character "${char.name}" (id=${char.id})`);

                // Load portrait if available
                if (char.portraitImageId) {
                  const [img] = await db
                    .select({ data: generatedImages.data, mimeType: generatedImages.mimeType })
                    .from(generatedImages)
                    .where(eq(generatedImages.id, char.portraitImageId));
                  if (img) {
                    portraitData = { data: img.data, mimeType: img.mimeType };
                  }
                }
              }
            }
          }

          // Append with portrait inline if available
          const responseParts: Array<Record<string, unknown>> = [
            { functionResponse: { name: funcName, response: { content: toolResult } } },
          ];
          if (portraitData) {
            responseParts.push(
              { inlineData: { mimeType: portraitData.mimeType, data: portraitData.data } },
              { text: "Ci-dessus le portrait/avatar du personnage. Utilise-le comme référence visuelle si tu dois générer une image le représentant." },
            );
          }
          contents = [
            ...contents,
            { role: "model", parts: [{ functionCall: { name: funcName, args: funcArgs } }] },
            { role: "user", parts: responseParts },
          ];
          continue;
        } else {
          console.error(`[chat] Unknown tool call: "${funcName}"`);
          toolResult = `Outil inconnu : ${funcName}`;
        }

        // Append tool call + result to contents and loop
        contents = [
          ...contents,
          {
            role: "model",
            parts: [{ functionCall: { name: funcName, args: funcArgs } }],
          },
          {
            role: "user",
            parts: [{ functionResponse: { name: funcName, response: { content: toolResult } } }],
          },
        ];
      }

      console.log(`[chat] user=${chatUser} tokens=${geminiTotalTokens} topic=${calledTopic ?? 'none'}`);
      if (!closed) {
        writeSse(res, "done", { model: GEMINI_MODEL, usage: null, topic: calledTopic });
        res.end();
      }
      return;
    }

    // ── ANTHROPIC ────────────────────────────────────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      writeSse(res, "error", {
        error: "ANTHROPIC_API_KEY manquante. Ajoute-la dans server/.env.",
      });
      res.end();
      return;
    }

    let calledTopic: TopicName | null = null;

    // Turn 1 — streaming: text is emitted live, tool call detected at the end
    const turn1Stream = anthropicClient.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      tools: [anthropicTool],
      tool_choice: { type: "auto" },
      messages: apiMessages,
    });

    for await (const event of turn1Stream) {
      if (closed) break;
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta" &&
        typeof event.delta.text === "string"
      ) {
        writeSse(res, "delta", { text: event.delta.text });
      }
    }

    const turn1Final = await turn1Stream.finalMessage();
    logTokens("anthropic turn1", {
      input: turn1Final.usage.input_tokens,
      output: turn1Final.usage.output_tokens,
    });

    const toolUseBlock = turn1Final.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === "load_knowledge"
    );

    if (toolUseBlock) {
      const rawTopic = (toolUseBlock.input as { topic?: string }).topic ?? "";
      if ((TOPIC_NAMES as readonly string[]).includes(rawTopic)) {
        calledTopic = rawTopic as TopicName;
      }
    }

    if (toolUseBlock && !calledTopic && !closed) {
      const rawTopic = (toolUseBlock.input as { topic?: string }).topic ?? "";
      console.error(`[knowledge] load_knowledge ignored unknown topic: "${rawTopic}"`);
      writeSse(res, "error", {
        error:
          "Le serveur ne reconnaît pas ce sujet de règles. Recharge la page et réessaie.",
      });
      res.end();
      return;
    }

    if (toolUseBlock && calledTopic && !closed) {
      console.log(`[knowledge] AI requested topic: "${calledTopic}" (anthropic)`);
      writeSse(res, "tool_use", { topic: calledTopic });

      let knowledgeText: string;
      try {
        knowledgeText = await loadTopic(calledTopic);
        console.log(`[knowledge] Loaded topic: "${calledTopic}"`);
      } catch {
        console.error(`[knowledge] Failed to load topic: "${calledTopic}"`);
        writeSse(res, "error", { error: "Impossible de charger le sujet demandé." });
        res.end();
        return;
      }

      const messagesWithTool: Anthropic.MessageParam[] = [
        ...apiMessages,
        { role: "assistant", content: turn1Final.content },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: toolUseBlock.id, content: knowledgeText }],
        },
      ];

      // Turn 2 — streaming final answer
      const stream2 = anthropicClient.messages.stream({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        tools: [anthropicTool],
        messages: messagesWithTool,
      });

      for await (const event of stream2) {
        if (closed) break;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          typeof event.delta.text === "string"
        ) {
          writeSse(res, "delta", { text: event.delta.text });
        }
      }

      const finalMessage = await stream2.finalMessage();
      logTokens("anthropic turn2", {
        input: finalMessage.usage.input_tokens,
        output: finalMessage.usage.output_tokens,
      });
      const anthropicTotalTokens = (turn1Final.usage.input_tokens + turn1Final.usage.output_tokens)
        + (finalMessage.usage.input_tokens + finalMessage.usage.output_tokens);
      console.log(`[chat] user=${chatUser} tokens=${anthropicTotalTokens} topic=${calledTopic ?? 'none'}`);
      if (!closed) {
        writeSse(res, "done", {
          model: finalMessage.model,
          usage: finalMessage.usage,
          topic: calledTopic,
        });
        res.end();
      }
    } else {
      console.log("[knowledge] No tool call — answering from core index (anthropic)");
      const anthropicTotalTokens = turn1Final.usage.input_tokens + turn1Final.usage.output_tokens;
      console.log(`[chat] user=${chatUser} tokens=${anthropicTotalTokens} topic=none`);
      if (!closed) {
        writeSse(res, "done", {
          model: turn1Final.model,
          usage: turn1Final.usage,
          topic: null,
        });
        res.end();
      }
    }
  } catch (err) {
    console.error(err);
    const status =
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      typeof (err as { status?: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
    const message =
      status === 429
        ? "Limite API atteinte (trop de tokens). Reessaie dans quelques secondes ou choisis un sujet plus cible."
        : err instanceof Error
          ? err.message
          : "Chat request failed";
    if (res.headersSent) {
      writeSse(res, "error", { error: message });
      res.end();
      return;
    }
    res.status(status).json({ error: message });
  }
});

// Production: Vite build + Vue Router (history) fallback — register after /api routes
if (existsSync(CLIENT_DIST)) {
  // Hashed assets (JS/CSS) — immutable, long cache
  app.use(
    "/assets",
    express.static(join(CLIENT_DIST, "assets"), {
      maxAge: "1y",
      immutable: true,
    })
  );
  // Everything else (index.html, sw.js, manifest) — always revalidate
  app.use(
    express.static(CLIENT_DIST, {
      maxAge: 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(join(CLIENT_DIST, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

const PORT = Number(process.env.PORT) || 3566;

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  if (databaseUrl) {
    await runMigrations(databaseUrl);
  } else {
    console.warn(
      "[migrate] No DATABASE_URL / POSTGRES_URL — skipping migrations (chat-only mode or misconfiguration).",
    );
  }
  app.listen(PORT, () => {
    console.log(`arran-dnd API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
