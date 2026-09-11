import "./loadEnv.js";
import { getDatabaseUrl } from "./db/databaseUrl.js";
import { runMigrations } from "./db/runMigrations.js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
// Express 4 ne rattrape pas les rejets des handlers async : sans ça, une erreur
// DB devient une unhandledRejection et tue le process. Doit être importé avant les routes.
import "express-async-errors";
import authRouter from "./routes/auth.js";
import charactersRouter from "./routes/characters.js";
import journalRouter from "./routes/journal.js";
import campaignsRouter from "./routes/campaigns.js";
import combatsRouter, { activeCombatRouter } from "./routes/combats.js";
import codexRouter from "./routes/codex.js";
import notesRouter from "./routes/notes.js";
import revisionsRouter from "./routes/revisions.js";
import ttsRouter from "./routes/tts.js";
import devRouter from "./dev/routes.js";
import { devToolsEnabled } from "./dev/enabled.js";
import { requireAuth, type AuthRequest } from "./auth/middleware.js";
import {
  buildStaticBlock,
  loadAllKnowledge,
  loadBestiaire,
  loadMonster,
  loadMonsterNames,
} from "./knowledge/loadKnowledge.js";
import { CLIENT_DIST, REPO_ROOT } from "./paths.js";
import { buildAnthropicTools, buildGeminiTool, TOPIC_NAMES } from "./knowledge/tools.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db/index.js";
import { campaigns, campaignMembers, characters, codexEntries, combatParticipants, combats, generatedImages, journalCompagnie, journalPages, notes, rollEvents, users } from "./db/schema.js";
import { buildCampaignSection, type JournalContext, type PartyContext } from "./chat/campaignContext.js";
import { buildCombatSection, type CombatRoll } from "./chat/combatContext.js";
import { serializeCombat } from "./combats/serialize.js";
import { enrichParticipantHp, enrichParticipantStates } from "./combats/sseStore.js";

const app = express();
// En prod le client est servi par ce même serveur (same-origin) ; en dev le proxy
// Vite rend aussi les requêtes same-origin. On ne whiteliste que CLIENT_URL + dev.
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL ?? "http://localhost:5173",
  "http://localhost:5173",
];
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
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
app.use("/api/journal", journalRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/campaigns", combatsRouter);
app.use("/api/combats", activeCombatRouter);
app.use("/api/campaigns", codexRouter);
app.use("/api/notes", notesRouter);

// Outils de dev : seed, changement d'identité, combats bidon. Contournent
// l'authentification, donc jamais montés en prod (voir dev/enabled.ts).
if (devToolsEnabled()) {
  app.use("/api/dev", devRouter);
  console.log("[dev] outils de dev actifs sur /api/dev");
}
app.use("/api/revisions", revisionsRouter);
app.use("/api/tts", ttsRouter);

/**
 * Une image est visible par son propriétaire, ou si elle sert de portrait au
 * personnage d'un membre d'une campagne que le demandeur partage avec lui.
 */
async function canSeeImage(imageId: number, ownerId: number, userId: number) {
  if (ownerId === userId) return true;
  const mine = db
    .select({ campaignId: campaignMembers.campaignId })
    .from(campaignMembers)
    .where(eq(campaignMembers.userId, userId));
  const [shared] = await db
    .select({ id: campaignMembers.id })
    .from(campaignMembers)
    .innerJoin(characters, eq(characters.id, campaignMembers.characterId))
    .where(and(eq(characters.portraitImageId, imageId), inArray(campaignMembers.campaignId, mine)))
    .limit(1);
  return Boolean(shared);
}

// Serve generated images from database (owner, or campaign mate's portrait)
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
    .where(eq(generatedImages.id, id));
  if (!row || !(await canSeeImage(id, row.userId, userId))) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const buffer = Buffer.from(row.data, "base64");
  res.setHeader("Content-Type", row.mimeType);
  res.setHeader("Cache-Control", "private, max-age=604800, immutable");
  res.setHeader("Content-Length", buffer.length);
  res.end(buffer);
});

/**
 * Avatar d'un utilisateur, servi en binaire.
 * L'avatar peut changer sous la même URL : pas de cache "immutable", mais un
 * ETag revalidé à chaque fois (304 vide si inchangé, jamais de version périmée).
 */
app.get("/api/users/:id/avatar", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  const [row] = await db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, id));
  const parsed = row?.avatarUrl?.match(/^data:([^;]+);base64,(.+)$/s);
  if (!parsed) {
    res.status(404).json({ error: "Avatar not found" });
    return;
  }
  const [, mimeType, data] = parsed;
  const etag = `"${createHash("sha1").update(data).digest("base64url")}"`;
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.setHeader("ETag", etag);
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }
  const buffer = Buffer.from(data, "base64");
  res.setHeader("Content-Type", mimeType);
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
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
/** Available image generation models (best first). Override with GEMINI_IMAGE_MODEL env var. */
const GEMINI_IMAGE_MODELS = [
  "gemini-3.1-flash-image",         // Nano Banana 2 (GA) — best quality/price, up to 4K
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
// Instancié seulement si la clé existe : le SDK jette sinon et tuerait le boot
// même en mode AI_PROVIDER=gemini. L'endpoint /api/chat re-vérifie avant usage.
const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const SYSTEM_PREAMBLE = `Tu incarnes Isilwen du Miroir Astral, une Elfe Bleue divinatrice et mystique du monde des Terres d'Arran, utilisant le moteur Chroniques Oubliées.
Tu t'adresses aux joueurs et au meneur en français, toujours en restant en personnage.

📖 Rigueur des règles — c'est ta mission principale :
- L'intégralité des règles et du lore dont tu disposes est reproduite ci-dessous. Lis-la, cite-la, applique-la.
- RÈGLE ABSOLUE : ne donne JAMAIS un chiffre (bonus, coût en PM, dégâts, difficulté, durée, portée, prix) qui ne figure pas dans les règles ci-dessous. Aucune exception, même si le chiffre te semble évident ou standard ailleurs.
- Si une règle manque ou est ambiguë, dis-le en une phrase, propose de vérifier le livre officiel, puis donne une alternative prudente clairement annoncée comme telle.
- Croise les sources : une réponse complète combine souvent une règle générale, une capacité de voie et la fiche du personnage. Vérifie les exceptions avant de conclure.
- Applique les règles au personnage actif : calcule avec SES caractéristiques, SON niveau, SES voies, et montre le calcul.

⚡ Concision avant tout :
- Réponds de façon directe et concise. Va à l'essentiel sans tourner autour du pot.
- Utilise les émojis quand ils ajoutent de la clarté ou de la lisibilité (listes, catégories, points importants).
- Évite les longues introductions, les répétitions et les formules creuses. Une bonne réponse est courte et utile.
- Structure : info utile d'abord, couleur narrative ensuite — jamais l'inverse.

🎭 Style de roleplay (intégré et constant) :
- Reste en personnage du début à la fin, sans rupture de ton ni "mode d'emploi".
- Fonds naturellement le roleplay avec les règles : ton immersif, explications précises, transitions fluides.
- Taquinerie bienvenue, toujours bienveillante — jamais agressive ni humiliante.
- Si un personnage actif est fourni dans le contexte, adresse-toi à lui par son prénom et adapte tes conseils à sa race, son profil, son histoire (si fournie), ses armes et capacités, et son niveau.

🐉 Bestiaire (règle stricte) :
- L'index des créatures est ci-dessous ; leur fiche détaillée se lit avec l'outil get_monstre quand il t'est proposé.
- Tu ne dois JAMAIS révéler de données chiffrées sur les monstres aux joueurs : pas de PV, DEF, NC, bonus d'attaque, DM, caractéristiques (FOR, DEX, etc.), initiative, ou réduction de dégâts.
- Tu peux uniquement partager avec un joueur : le nom du monstre, sa taille, sa description narrative, et le nom de ses capacités (sans les détails mécaniques).
- Si un joueur demande les stats d'un monstre, refuse poliment en restant en personnage : "Les mystères de cette créature ne se révèlent qu'au combat..."
- Exception : quand le contexte indique que tu parles au meneur de jeu (section Combat en cours, ou outil get_monstre disponible), ces chiffres sont pour lui. Donne-les.

✏️ Modification de fiche (edit_character) — SEUL outil nécessitant confirmation :
- Tu peux modifier les statistiques du personnage (FOR, DEX, CON, INT, SAG, CHA, niveau, PV max, PM max, défense) avec l'outil edit_character.
- Avant d'appeler edit_character, annonce EXACTEMENT ce que tu vas changer et attends la confirmation explicite du joueur ("oui", "ok", "vas-y", "d'accord"...).
  Exemple : "Je peux passer ta FOR de 10 à 12 — veux-tu que je le fasse ?"
- N'appelle JAMAIS edit_character si l'utilisateur n'a pas confirmé dans son dernier message.
- Après modification, confirme brièvement en restant en personnage.
- Cette règle de confirmation s'applique UNIQUEMENT à edit_character. Tous les autres outils s'utilisent IMMÉDIATEMENT, sans demander confirmation.

↩️ Annulation (undo) :
- Si un previousCharacter est présent dans le contexte du personnage, cela signifie qu'une modification a été faite lors de cette conversation.
- Si l'utilisateur demande d'annuler ("annule", "undo", "remets comme avant"...), demande confirmation puis appelle edit_character avec les valeurs du previousCharacter.
- Ne propose l'annulation que si previousCharacter est présent dans le contexte.

📜 Campagne, journal, codex et notes (get_page) :
- Le journal de bord, le Codex de la campagne (PNJ, lieux) et les notes privées du joueur sont reproduits ci-dessous, après la fiche du personnage. Tu n'as rien à demander : réponds directement depuis ces textes.
- Dès qu'un joueur pose une question sur leurs aventures, sessions passées, PNJ rencontrés, lieux visités ou événements vécus → réponds depuis le journal ou le Codex, en citant la session ou l'entrée concernée.
- Seuls les titres des pages partagées sont listés (avec leur id). Si un titre semble pertinent pour la question, appelle immédiatement get_page avec cet id pour en lire le contenu. Ne demande pas "veux-tu que je consulte la page ?".

🗡️ Combat en cours :
- S'il y a une section "Combat en cours" ci-dessous, utilise-la pour tout conseil tactique : à qui c'est le tour, qui est en danger, quelle action est possible d'après les règles de combat ci-dessus.
- Pour un joueur : ce que contient cette section est exactement ce qu'il voit à l'écran, tu peux le lui dire. Rien de plus sur les monstres : la règle 🐉 s'applique toujours.
- Pour le meneur : tu as tout (PV, DEF, attaques, capacités, réserve). Aide-le à faire jouer les monstres.
- Pas de section "Combat en cours" = pas de combat en cours. Ne l'invente pas.

👥 Compagnons de campagne (get_character) :
- La liste de tes compagnons de campagne est dans la section Campagne, plus bas.
- get_character te donne la fiche complète d'un compagnon (profil, stats, voies, compétences, portrait). Utilise-le de façon proactive, et pour connaître l'apparence physique d'un compagnon — ne demande jamais au joueur de décrire quelqu'un dont tu peux lire la fiche.

🎨 Illustration (generate_image) :
- Le prompt DOIT être en anglais, détaillé, style "medieval high fantasy, painterly, warm tones", et inclure le contexte du monde d'Arran (elfes, nains, cristaux, forêts anciennes...).
- L'image doit TOUJOURS être une illustration plein cadre : ajoute "full frame illustration, no borders, no book page, no white margins" à chaque prompt.
- Avant de générer une image représentant un ou plusieurs personnages joueurs, appelle TOUJOURS get_character sur chacun d'eux dans CE tour — le portrait n'est transmis au générateur que s'il est récupéré dans le même tour.
- Quand le joueur demande une image impliquant des compagnons ("dessine-nous", "illustre la scène"), enchaîne get_character puis generate_image directement, sans demander les noms.
- N'utilise PAS cet outil pour les questions de règles ou de statistiques. Maximum 1 image par réponse sauf demande explicite.`;

// ── BLOC STATIQUE ────────────────────────────────────────────────────────────
// Calcule UNE FOIS au demarrage : preambule + toutes les regles (sauf bestiaire)
// + l'index des monstres. C'est la tete du prompt, donc la partie mise en cache
// par le fournisseur. Rien de variable ne doit jamais passer au-dessus : un seul
// octet qui change invalide tout le cache de prefixe qui suit.
const BESTIAIRE_TEXT = loadBestiaire();
const MONSTER_NAMES = loadMonsterNames(BESTIAIRE_TEXT);
const STATIC_SYSTEM = buildStaticBlock(SYSTEM_PREAMBLE, loadAllKnowledge(), MONSTER_NAMES);
console.log(
  `[knowledge] Bloc statique monte : ${STATIC_SYSTEM.length} caracteres, ${MONSTER_NAMES.length} monstres indexes`
);
// loadEnv utilise override:false : un `npm run dev` deja lance garde l'ancien modele
// malgre un changement de server/.env. Logguer le modele reel evite la fausse piste.
console.log(`[chat] provider=${AI_PROVIDER} modele=${AI_PROVIDER === "gemini" ? GEMINI_MODEL : ANTHROPIC_MODEL}`);


type ChatMessage = { role: "user" | "assistant"; content: string };
type SseEvent = "delta" | "done" | "error" | "tool_use" | "character_updated" | "image";

/**
 * Message d'erreur destine au joueur. Le detail technique reste dans les logs :
 * le SDK Gemini leve des Error dont le `.message` est le corps JSON brut de l'API,
 * qu'il ne faut jamais afficher dans le chat.
 */
function playerFacingError(status: number): string {
  if (status === 429) return "Isilwen est trop sollicitee en ce moment. Reessaie dans quelques secondes.";
  if (status === 401 || status === 403) return "Isilwen ne repond pas : sa connexion est mal configuree. Previens le meneur de jeu.";
  if (status === 400) return "Isilwen n'a pas pu traiter cette demande. Reformule ta question, ou previens le meneur de jeu si ca se repete.";
  return "Isilwen s'est perdue dans les astres. Reessaie dans un instant.";
}

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
  usage: { input?: number; output?: number; total?: number; cached?: number }
): void {
  const parts: string[] = [];
  if (usage.input != null) parts.push(`in=${usage.input}`);
  if (usage.cached != null) parts.push(`cached=${usage.cached}`);
  if (usage.output != null) parts.push(`out=${usage.output}`);
  if (usage.total != null) parts.push(`total=${usage.total}`);
  console.log(`[tokens] ${label}: ${parts.join(" ")}`);
}


type CharacterPayload = Record<string, unknown>;

function buildCharacterSection(c: CharacterPayload, isActive = false): string {
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

  const header = isActive ? "## Personnage actif" : `## Fiche de ${name}`;
  const footer = isActive
    ? "\n\n👤 Adresse-toi toujours à ce personnage par son prénom. Adapte tes réponses à sa race, son profil, son histoire (si fournie), ses armes et ses capacités."
    : "";

  return `${header}

${isActive ? `Tu t'adresses à **${name}**` : `**${name}**`}${people ? `, ${people}` : ""}${profile ? `, profil ${profile}` : ""}, niveau ${level}.
Stats : FOR ${str} (${fmtMod(str)}) / DEX ${dex} (${fmtMod(dex)}) / CON ${con} (${fmtMod(con)}) / INT ${int_} (${fmtMod(int_)}) / SAG ${wis} (${fmtMod(wis)}) / CHA ${cha} (${fmtMod(cha)})
${pvPmLine} | Défense ${defense}${extraBlocks ? `\n${extraBlocks}` : ""}
Voies : ${pathsStr}
Compétences : ${skillsStr}${histoireBlock}${footer}`;
}

type GeminiPart = Record<string, unknown>;
type GeminiContent = { role: string; parts: GeminiPart[] };

function messagestoGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

/**
 * Le stream decoupe le texte en dizaines de parts. On les recolle pour reinjecter
 * un tour de modele propre — en preservant chaque part porteuse d'autre chose
 * (functionCall, thought, thoughtSignature), sans quoi Gemini 3 renvoie
 * `400 Function call is missing a thought_signature`.
 */
function mergeGeminiParts(parts: GeminiPart[]): GeminiPart[] {
  const isPlainText = (p: GeminiPart) => {
    const keys = Object.keys(p);
    return keys.length === 1 && keys[0] === "text";
  };
  const out: GeminiPart[] = [];
  for (const part of parts) {
    const last = out[out.length - 1];
    if (last && isPlainText(part) && isPlainText(last)) {
      last.text = String(last.text) + String(part.text);
    } else {
      out.push({ ...part });
    }
  }
  return out;
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

async function fetchPartyContext(userId: number): Promise<PartyContext | null> {
  const [user] = await db
    .select({ activeCampaignId: users.activeCampaignId })
    .from(users)
    .where(eq(users.id, userId));
  if (!user?.activeCampaignId) return null;

  const [campaign] = await db
    .select({ name: campaigns.name, gmUserId: campaigns.gmUserId })
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

  const codex = await db
    .select({ type: codexEntries.type, name: codexEntries.name, description: codexEntries.description })
    .from(codexEntries)
    .where(eq(codexEntries.campaignId, user.activeCampaignId))
    .orderBy(codexEntries.type, codexEntries.name);

  return {
    campaignId: user.activeCampaignId,
    campaignName: campaign.name,
    gmUserId: campaign.gmUserId,
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
    codex,
  };
}

// Combat actif de la campagne, vu avec les memes droits que l'ecran de combat
// (serializeCombat masque les monstres pour un joueur). Null si aucun combat.
const COMBAT_ROLLS_LIMIT = 20;
async function fetchCombatContext(campaignId: number, userId: number, isGm: boolean): Promise<string | null> {
  const [combat] = await db
    .select()
    .from(combats)
    .where(and(eq(combats.campaignId, campaignId), eq(combats.status, "active")))
    .orderBy(desc(combats.createdAt))
    .limit(1);
  if (!combat) return null;

  let participants = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combat.id));
  participants = await enrichParticipantHp(campaignId, participants);
  participants = await enrichParticipantStates(campaignId, participants);
  const serialized = serializeCombat(combat, participants, isGm);

  const rollFilter = isGm
    ? eq(rollEvents.combatId, combat.id)
    : and(eq(rollEvents.combatId, combat.id), eq(rollEvents.visibility, "public"));
  const rows = await db
    .select({ actorName: rollEvents.actorName, label: rollEvents.label, total: rollEvents.total, damage: rollEvents.damage })
    .from(rollEvents)
    .where(rollFilter)
    .orderBy(desc(rollEvents.createdAt), desc(rollEvents.id))
    .limit(COMBAT_ROLLS_LIMIT);
  // Les plus recents d'abord en base, ordre chronologique dans le prompt.
  const rolls: CombatRoll[] = rows.reverse().map((r) => ({
    actorName: r.actorName,
    label: r.label,
    total: r.total,
    damage: (r.damage as CombatRoll["damage"]) ?? null,
  }));

  return buildCombatSection(serialized, rolls, userId);
}

// Journal de bord entier, titres des pages partagees et notes texte du joueur.
// Le journal et les pages ne sont pas scopes par campagne en base (voir plan 26, § 6).
async function fetchJournalContext(userId: number): Promise<JournalContext> {
  const [row] = await db.select().from(journalCompagnie).where(eq(journalCompagnie.id, 1));
  const editedBy = await charNameByUserId(row?.updatedByUserId ?? null);
  const pages = await db
    .select({ id: journalPages.id, title: journalPages.title })
    .from(journalPages)
    .orderBy(journalPages.updatedAt);
  const userNotes = await db
    .select({ title: notes.title, content: notes.content })
    .from(notes)
    .where(and(eq(notes.ownerUserId, userId), eq(notes.type, "text")))
    .orderBy(notes.updatedAt);

  return { content: row?.content ?? "", editedBy, pages, notes: userNotes };
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

// ── EXÉCUTION DES OUTILS ─────────────────────────────────────────────────────
// Une seule implémentation, partagée par Gemini et Anthropic. Les échecs sont
// rendus au modèle sous forme de texte : il explique lui-même au joueur plutôt
// que de couper le flux en plein milieu d'une réponse.
type ToolContext = {
  res: express.Response;
  chatUserId: number;
  character: CharacterPayload | null;
  party: PartyContext | null;
  /** name → portraitImageId, alimenté par get_character et consommé par generate_image. */
  portraitIds: Map<string, number>;
  isGm: boolean;
};

type ToolOutcome = { text: string; portrait?: { data: string; mimeType: string } };

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolOutcome> {
  const { res, chatUserId, character, party, portraitIds } = ctx;

  if (name === "get_monstre") {
    // Double verrou : l'outil n'est pas exposé aux joueurs, et refuse quand même s'il est appelé.
    if (!ctx.isGm) return { text: "Outil réservé au meneur de jeu." };
    const nom = String(args.nom ?? "");
    writeSse(res, "tool_use", { tool: "get_monstre", label: `Consultation du bestiaire : ${nom}` });
    const sheet = loadMonster(BESTIAIRE_TEXT, nom);
    if (!sheet) {
      console.log(`[bestiaire] Monstre inconnu : "${nom}"`);
      return { text: `Aucune créature nommée "${nom}" dans le bestiaire. Vérifie l'orthographe dans l'index fourni.` };
    }
    console.log(`[bestiaire] Fiche chargée : "${nom}" (${sheet.length} chars)`);
    return { text: sheet };
  }

  if (name === "edit_character") {
    const safeChanges = sanitizeChanges((args.changes as Record<string, unknown>) ?? {});
    if (Object.keys(safeChanges).length === 0) {
      return { text: "Aucun champ valide à modifier — la fiche n'a pas été touchée." };
    }
    const charId = Number(character?.id);
    if (!Number.isFinite(charId) || charId <= 0) {
      return { text: "Identifiant de personnage invalide — la fiche n'a pas été modifiée." };
    }
    // Scopé sur l'utilisateur du chat : on ne modifie jamais la fiche d'un autre joueur
    const [oldRow] = await db.select().from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, chatUserId)));
    if (!oldRow) return { text: "Personnage introuvable — la fiche n'a pas été modifiée." };

    const [updatedRow] = await db
      .update(characters)
      .set({ ...safeChanges, updatedAt: new Date() })
      .where(and(eq(characters.id, charId), eq(characters.userId, chatUserId)))
      .returning();

    console.log(`[edit_character] Updated character ${charId}:`, safeChanges);
    writeSse(res, "character_updated", { character: updatedRow, previousCharacter: oldRow });
    return { text: `Modification appliquée : ${JSON.stringify(safeChanges)}` };
  }

  if (name === "get_page") {
    const pageId = Number(args.id);
    if (!Number.isFinite(pageId) || pageId <= 0) return { text: "Identifiant de page invalide." };
    const [page] = await db.select().from(journalPages).where(eq(journalPages.id, pageId));
    writeSse(res, "tool_use", { tool: "get_page", label: `Lecture de la page : ${page?.title ?? pageId}` });
    if (!page) return { text: `Aucune page trouvée avec l'id ${pageId}.` };
    const editedBy = await charNameByUserId(page.updatedByUserId);
    const content = page.content ?? "";
    const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n\n[…contenu tronqué]" : content;
    const byLine = editedBy ? `\nDernière modification par : ${editedBy}\n` : "";
    console.log(`[journal] Loaded page ${pageId}`);
    return { text: `# ${page.title}${byLine}\n${truncated}` };
  }

  if (name === "generate_image") {
    const imagePrompt = String(args.prompt ?? "");
    console.log(`[generate_image] Prompt requested:\n${imagePrompt}`);
    writeSse(res, "tool_use", { tool: "generate_image", label: "Génération d'une illustration…" });
    if (!geminiClient) return { text: "La génération d'image est indisponible (GEMINI_API_KEY manquante)." };

    try {
      // Load all cached portraits in one query
      const portraits: Array<{ name: string; data: string; mimeType: string }> = [];
      if (portraitIds.size > 0) {
        const ids = [...portraitIds.values()];
        const rows = await db
          .select({ id: generatedImages.id, data: generatedImages.data, mimeType: generatedImages.mimeType })
          .from(generatedImages)
          .where(inArray(generatedImages.id, ids));
        const rowById = new Map(rows.map((r) => [r.id, r]));
        for (const [pname, imgId] of portraitIds) {
          const row = rowById.get(imgId);
          if (row) {
            portraits.push({ name: pname, data: row.data, mimeType: row.mimeType });
            const sizeKb = Math.round((row.data.length * 3) / 4 / 1024);
            console.log(`[generate_image] Personnage chargé ${pname} (${sizeKb} KB)`);
          }
        }
      }

      // Build image parts: style ref first, then portraits, then prompt
      const imageParts: Array<Record<string, unknown>> = [];
      if (styleRefBase64) {
        imageParts.push({ inlineData: { mimeType: "image/jpeg", data: styleRefBase64 } });
      }
      for (const p of portraits) {
        imageParts.push({ inlineData: { mimeType: p.mimeType, data: p.data } });
      }

      const hasStyle = !!styleRefBase64;
      const portraitNames = portraits.map((p) => p.name).join(", ");
      let textPrefix: string;
      if (hasStyle && portraits.length > 0) {
        textPrefix = `Generate a full-frame illustration in the exact same artistic style as the first reference image (European fantasy comic art). Match the color palette, ink linework, and painterly rendering. The following ${portraits.length > 1 ? "images are character portraits" : "image is a character portrait"} for: ${portraitNames} — use ${portraits.length > 1 ? "them" : "it"} as visual reference for the characters' appearance (face, hair, build, clothing). IMPORTANT: full bleed illustration filling the entire frame, no borders, no book pages, no white margins, no photo of a page. Subject: `;
      } else if (portraits.length > 0) {
        textPrefix = `The attached ${portraits.length > 1 ? "images are character portraits" : "image is a character portrait"} for: ${portraitNames} — use ${portraits.length > 1 ? "them" : "it"} as visual reference for the characters' appearance (face, hair, build, clothing). IMPORTANT: full bleed illustration filling the entire frame, no borders, no book pages, no white margins. Subject: `;
      } else if (hasStyle) {
        textPrefix = "Generate a full-frame illustration in the exact same artistic style as this reference (European fantasy comic art). Match the color palette, ink linework, and painterly rendering. IMPORTANT: full bleed illustration filling the entire frame, no borders, no book pages, no white margins, no photo of a page. Subject: ";
      } else {
        textPrefix = "";
      }
      imageParts.push({ text: textPrefix + imagePrompt });

      const imageResponse = await geminiClient.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts: imageParts }],
        config: { responseModalities: ["Text", "Image"] },
      });

      const parts = imageResponse.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find(
        (p) => (p.inlineData as { mimeType?: string } | undefined)?.mimeType?.startsWith("image/")
      );
      const inlineData = imagePart?.inlineData as { mimeType: string; data: string } | undefined;

      if (!inlineData) {
        console.error("[generate_image] No image part in response");
        return { text: "La génération d'image a échoué — aucune image retournée par le modèle." };
      }

      const [inserted] = await db
        .insert(generatedImages)
        .values({ userId: chatUserId, data: inlineData.data, mimeType: inlineData.mimeType, prompt: imagePrompt })
        .returning({ id: generatedImages.id });

      writeSse(res, "image", { url: `/api/images/${inserted.id}`, alt: imagePrompt });
      console.log(`[generate_image] Done — saved image ${inserted.id} (${inlineData.mimeType})`);
      return { text: "Image générée avec succès. L'image est affichée dans le chat. Continue ta réponse normalement sans re-décrire l'image en détail." };
    } catch (err) {
      console.error("[generate_image] Error:", err);
      return { text: "Erreur lors de la génération de l'image. Réessaie plus tard." };
    }
  }

  if (name === "get_character") {
    const targetName = String(args.name ?? "");
    writeSse(res, "tool_use", { tool: "get_character", label: `Consultation de ${targetName}…` });

    if (!party) return { text: "Aucune campagne active — impossible de consulter les compagnons." };
    const match = party.members.find((m) => m.name.toLowerCase().includes(targetName.toLowerCase()));
    if (!match) return { text: `Aucun compagnon nommé "${targetName}" dans la campagne.` };

    const [char] = await db.select().from(characters).where(eq(characters.id, match.characterId));
    if (!char) return { text: "Personnage introuvable en base de données." };

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
    const text = buildCharacterSection(charPayload);
    console.log(`[get_character] Loaded character "${char.name}" (id=${char.id})`);

    if (!char.portraitImageId) return { text };
    // Cache portrait ID for generate_image
    portraitIds.set(char.name, char.portraitImageId);
    const [img] = await db
      .select({ data: generatedImages.data, mimeType: generatedImages.mimeType })
      .from(generatedImages)
      .where(eq(generatedImages.id, char.portraitImageId));
    return img ? { text, portrait: { data: img.data, mimeType: img.mimeType } } : { text };
  }

  console.error(`[chat] Unknown tool call: "${name}"`);
  return { text: `Outil inconnu : ${name}` };
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
    const characterSection = character ? `\n\n${buildCharacterSection(character, true)}` : "";
    const previousSection = character && previousCharacter ? buildPreviousCharacterSection(previousCharacter) : "";
    const party = await fetchPartyContext(chatUserId);
    const activeCharId = character ? Number(character.id) : null;
    const journal = await fetchJournalContext(chatUserId);
    const campaignSection = buildCampaignSection(party, activeCharId, journal);
    console.log(`[chat] section campagne : ${campaignSection.length} caracteres`);
    // MJ de la campagne active : verifie cote serveur, jamais deduit du prompt.
    const isGm = party?.gmUserId === chatUserId;
    // Le combat change a chaque tour : il passe apres le journal pour garder le prefixe stable.
    const combatSection = party ? (await fetchCombatContext(party.campaignId, chatUserId, isGm)) ?? "" : "";
    console.log(`[chat] section combat : ${combatSection.length} caracteres`);
    // Ordre impose : tout ce qui bouge (fiche, campagne, undo) passe APRES le bloc statique.
    const system = `${STATIC_SYSTEM}${characterSection}${campaignSection}${combatSection}${previousSection}`;

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

    const MAX_TOOL_TURNS = 5;

    // Portraits collectés pendant la requête (name → portraitImageId), lus par generate_image.
    const portraitIds = new Map<string, number>();
    const currentPortraitId = character ? (character as Record<string, unknown>).portraitImageId : null;
    if (typeof currentPortraitId === "number" && currentPortraitId > 0) {
      const currentName = character ? String((character as Record<string, unknown>).name ?? "Joueur") : "Joueur";
      portraitIds.set(currentName, currentPortraitId);
    }
    const toolCtx: ToolContext = { res, chatUserId, character, party, portraitIds, isGm };

    // ── GEMINI ───────────────────────────────────────────────────────────────
    if (AI_PROVIDER === "gemini") {
      if (!geminiClient) {
        console.error("[chat] GEMINI_API_KEY manquante dans server/.env");
        writeSse(res, "error", { error: playerFacingError(401) });
        res.end();
        return;
      }

      let contents: GeminiContent[] = messagestoGeminiContents(messages);
      let geminiTotalTokens = 0;

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const allParts: GeminiPart[] = [];
        // Le texte du tour est bufferisé : on ne l'émet que si le tour ne finit
        // pas sur un appel d'outil, sinon le joueur voit une réponse improvisée
        // puis une seconde après lecture.
        let pendingText = "";
        let lastUsage:
          | { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; cachedContentTokenCount?: number }
          | undefined;

        const stream = await geminiClient.models.generateContentStream({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: system,
            tools: [buildGeminiTool(isGm)],
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        for await (const chunk of stream) {
          if (closed) break;
          if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
          const parts = (chunk.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
          allParts.push(...parts);
          const text = typeof chunk.text === "string" ? chunk.text : "";
          if (text) pendingText += text;
        }

        logTokens(`gemini turn${turn + 1}`, {
          input: lastUsage?.promptTokenCount,
          output: lastUsage?.candidatesTokenCount,
          total: lastUsage?.totalTokenCount,
          cached: lastUsage?.cachedContentTokenCount,
        });
        geminiTotalTokens += lastUsage?.totalTokenCount ?? 0;

        if (closed) break;

        const calls = allParts.filter((p) => p.functionCall != null);
        if (calls.length === 0) {
          console.log(`[chat] No tool call on turn ${turn + 1} — done (gemini)`);
          if (pendingText) writeSse(res, "delta", { text: pendingText });
          break;
        }

        // Le tour du modèle est réinjecté INTACT : texte, thought et
        // thoughtSignature compris. Reconstruire { name, args } casse Gemini 3.
        contents = [...contents, { role: "model", parts: mergeGeminiParts(allParts) }];

        const responseParts: GeminiPart[] = [];
        for (const call of calls) {
          const fc = call.functionCall as { name?: string; args?: Record<string, unknown> };
          const funcName = fc.name ?? "";
          const funcArgs = fc.args ?? {};
          console.log(`[chat] Tool call on turn ${turn + 1}: ${funcName} (gemini)`);
          const outcome = await runTool(funcName, funcArgs, toolCtx);
          responseParts.push({
            functionResponse: { name: funcName, response: { content: outcome.text } },
          });
          if (outcome.portrait) {
            responseParts.push(
              { inlineData: { mimeType: outcome.portrait.mimeType, data: outcome.portrait.data } },
              { text: "Ci-dessus le portrait/avatar du personnage. Utilise-le comme référence visuelle si tu dois générer une image le représentant." },
            );
          }
        }
        contents = [...contents, { role: "user", parts: responseParts }];
      }

      console.log(`[chat] user=${chatUser} tokens=${geminiTotalTokens}`);
      if (!closed) {
        writeSse(res, "done", { model: GEMINI_MODEL, usage: null });
        res.end();
      }
      return;
    }

    // ── ANTHROPIC ────────────────────────────────────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[chat] ANTHROPIC_API_KEY manquante dans server/.env");
      writeSse(res, "error", { error: playerFacingError(401) });
      res.end();
      return;
    }

    const anthropicTools = buildAnthropicTools(isGm);
    let convo: Anthropic.MessageParam[] = [...apiMessages];
    let anthropicTotalTokens = 0;
    let lastFinal: Anthropic.Message | null = null;

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const stream = anthropicClient!.messages.stream({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Sonnet 5 réfléchit par défaut. "medium" laisse assez de marge pour
        // croiser deux règles avant de répondre (pendant de thinkingLevel low côté Gemini).
        output_config: { effort: "medium" },
        system,
        tools: anthropicTools,
        tool_choice: { type: "auto" },
        messages: convo,
      });

      // Même bufferisation que côté Gemini : rien à l'écran avant de savoir
      // si ce tour se termine par un appel d'outil.
      let pendingText = "";
      for await (const event of stream) {
        if (closed) break;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          typeof event.delta.text === "string"
        ) {
          pendingText += event.delta.text;
        }
      }

      const final = await stream.finalMessage();
      lastFinal = final;
      logTokens(`anthropic turn${turn + 1}`, {
        input: final.usage.input_tokens,
        output: final.usage.output_tokens,
        cached: final.usage.cache_read_input_tokens ?? undefined,
      });
      anthropicTotalTokens += final.usage.input_tokens + final.usage.output_tokens;

      if (closed) break;

      const toolUses = final.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      if (toolUses.length === 0) {
        console.log(`[chat] No tool call on turn ${turn + 1} — done (anthropic)`);
        if (pendingText) writeSse(res, "delta", { text: pendingText });
        break;
      }

      convo = [...convo, { role: "assistant", content: final.content }];

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUses) {
        console.log(`[chat] Tool call on turn ${turn + 1}: ${block.name} (anthropic)`);
        const outcome = await runTool(block.name, (block.input as Record<string, unknown>) ?? {}, toolCtx);
        const content: Anthropic.ToolResultBlockParam["content"] = outcome.portrait
          ? [
              { type: "text", text: outcome.text },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: outcome.portrait.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: outcome.portrait.data,
                },
              },
            ]
          : outcome.text;
        results.push({ type: "tool_result", tool_use_id: block.id, content });
      }
      convo = [...convo, { role: "user", content: results }];
    }

    console.log(`[chat] user=${chatUser} tokens=${anthropicTotalTokens}`);
    if (!closed) {
      writeSse(res, "done", {
        model: lastFinal?.model ?? ANTHROPIC_MODEL,
        usage: lastFinal?.usage ?? null,
      });
      res.end();
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
    const message = playerFacingError(status);
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

// Filet de sécurité : toute erreur non gérée d'un handler finit ici en 500 propre
// plutôt qu'en crash du process. Doit rester le dernier `app.use`.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Erreur serveur" });
});

const PORT = Number(process.env.PORT) || 3566;

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  if (process.env.FLY_APP_NAME) {
    // Sur Fly, les migrations tournent une seule fois via le release_command (fly.toml),
    // pas à chaque réveil de machine.
  } else if (databaseUrl) {
    await runMigrations(databaseUrl);
  } else {
    console.warn(
      "[migrate] No DATABASE_URL / POSTGRES_URL — skipping migrations (chat-only mode or misconfiguration).",
    );
  }
  app.listen(PORT, () => {
    console.log("🌍✨ Hello World ! 🐉🎲");
    console.log(`arran-dnd API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
