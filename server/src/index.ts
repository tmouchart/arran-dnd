import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import express from "express";
import { listBundles, DEFAULT_BUNDLE } from "./knowledge/bundles.js";
import { loadBundle } from "./knowledge/loadKnowledge.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

const AI_PROVIDER = process.env.AI_PROVIDER ?? "gemini";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const STREAM_CHUNK_SIZE = Number(process.env.STREAM_CHUNK_SIZE ?? 12);
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS ?? 1024);
const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const SYSTEM_PREAMBLE = `Tu incarnes Isilwen du Miroir Astral, une Elfe Bleue divinatrice et mystique du monde des Terres d'Arran, utilisant le moteur Chroniques Oubliées.
Tu t'adresses aux joueurs et au meneur en français, toujours en restant en personnage.

Style de roleplay (integre et constant) :
- Reste en personnage du debut a la fin de chaque reponse, sans "mode d'emploi" ni rupture de ton.
- Le roleplay doit se fondre naturellement avec les regles: explications precises, ton immersif, transitions fluides.
- Priorise toujours l'utilite: reponse claire, exploitable, structuree, puis couleur narrative sans alourdir.
- Taquinerie autorisee mais toujours bienveillante: jamais agressive, jamais humiliante.

Rigueur règles :
- Les extraits ci-dessous proviennent d'une base interne (knowledge/) : ce n'est PAS une copie complète du livre.
- Si une règle précise manque ou est incertaine, dis-le clairement en une phrase, propose de vérifier le livre du joueur officiel, puis donne une alternative prudente.
- N'invente pas de chiffres (bonus, coûts, DD) : si l'information n'est pas dans les extraits, ne la fabrique pas.`;

type ChatMessage = { role: "user" | "assistant"; content: string };
type SseEvent = "delta" | "done" | "error";

function writeSse(res: express.Response, event: SseEvent, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function splitForStream(text: string, size: number): string[] {
  if (size <= 0 || text.length <= size) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function toGeminiPrompt(system: string, messages: ChatMessage[]): string {
  const transcript = messages
    .map((m) => `${m.role === "assistant" ? "Assistant" : "Utilisateur"}: ${m.content}`)
    .join("\n\n");
  return `${system}\n\n## Historique de conversation\n\n${transcript}\n\nAssistant:`;
}

function inferBundleId(messages: ChatMessage[]): string {
  const available = new Set(listBundles());
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user")?.content;
  const text = (lastUserMessage ?? "").toLowerCase();

  if (!text) return DEFAULT_BUNDLE;

  const matchesAny = (keywords: string[]): boolean =>
    keywords.some((keyword) => text.includes(keyword));

  if (
    matchesAny([
      "combat",
      "initiative",
      "attaque",
      "armure",
      "defense",
      "défense",
      "degat",
      "dégât",
      "pv",
      "tour",
      "manoeuvre",
      "manoeuvre",
    ])
  ) {
    return available.has("combat") ? "combat" : DEFAULT_BUNDLE;
  }

  if (
    matchesAny([
      "magie",
      "sort",
      "sorts",
      "pm",
      "incantation",
      "rituel",
      "arcan",
      "mana",
    ])
  ) {
    return available.has("magic") ? "magic" : DEFAULT_BUNDLE;
  }

  if (
    matchesAny([
      "voie",
      "voies",
      "profil",
      "prestige",
      "rang",
      "capacite",
      "capacité",
    ])
  ) {
    return available.has("voies") ? "voies" : DEFAULT_BUNDLE;
  }

  if (
    matchesAny([
      "personnage",
      "creation",
      "création",
      "caracteristique",
      "caractéristique",
      "competence",
      "compétence",
      "origine",
      "race",
      "classe",
    ])
  ) {
    return available.has("creation") ? "creation" : DEFAULT_BUNDLE;
  }

  if (
    matchesAny([
      "arran",
      "monde",
      "royaume",
      "peuple",
      "culture",
      "histoire",
      "lore",
    ])
  ) {
    return available.has("monde") ? "monde" : DEFAULT_BUNDLE;
  }

  return DEFAULT_BUNDLE;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, bundles: listBundles(), defaultBundle: DEFAULT_BUNDLE });
});

app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body as {
      messages?: ChatMessage[];
    };
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages[] required" });
      return;
    }
    const bundleId = inferBundleId(messages);

    let knowledge: string;
    try {
      knowledge = await loadBundle(bundleId);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load knowledge bundle" });
      return;
    }

    const system = `${SYSTEM_PREAMBLE}\n\n## Base de regles (extraits)\n\n${knowledge}`;

    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const resolvedBundle = listBundles().includes(bundleId)
      ? bundleId
      : DEFAULT_BUNDLE;

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    if (AI_PROVIDER === "gemini") {
      if (!geminiClient) {
        res.status(500).json({
          error: "GEMINI_API_KEY manquante. Ajoute-la dans server/.env.",
        });
        return;
      }

      const prompt = toGeminiPrompt(system, messages);
      const stream = await geminiClient.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      for await (const chunk of stream) {
        if (closed) break;
        const text = typeof chunk.text === "string" ? chunk.text : "";
        if (!text) continue;
        const chunks = splitForStream(text, STREAM_CHUNK_SIZE);
        for (const piece of chunks) {
          writeSse(res, "delta", { text: piece });
        }
      }
      if (!closed) {
        writeSse(res, "done", {
          model: GEMINI_MODEL,
          usage: null,
          bundle: resolvedBundle,
        });
        res.end();
      }
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({
        error: "ANTHROPIC_API_KEY manquante. Ajoute-la dans server/.env.",
      });
      return;
    }

    const stream = anthropicClient.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: apiMessages,
    });

    for await (const event of stream) {
      if (closed) break;
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta" &&
        typeof event.delta.text === "string"
      ) {
        const chunks = splitForStream(event.delta.text, STREAM_CHUNK_SIZE);
        for (const chunk of chunks) {
          writeSse(res, "delta", { text: chunk });
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    if (!closed) {
      writeSse(res, "done", {
        model: finalMessage.model,
        usage: finalMessage.usage,
        bundle: resolvedBundle,
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

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`arran-dnd API listening on http://localhost:${PORT}`);
});
