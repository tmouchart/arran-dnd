import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import express from "express";
import { listBundles, DEFAULT_BUNDLE } from "./knowledge/bundles.js";
import { loadBundle } from "./knowledge/loadKnowledge.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

const MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const STREAM_CHUNK_SIZE = Number(process.env.STREAM_CHUNK_SIZE ?? 12);
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS ?? 1024);
const MAX_INPUT_TOKENS = Number(process.env.MAX_INPUT_TOKENS ?? 6000);
const MAX_KNOWLEDGE_TOKENS = Number(process.env.MAX_KNOWLEDGE_TOKENS ?? 3000);
const MAX_HISTORY_MESSAGES = Number(process.env.MAX_HISTORY_MESSAGES ?? 8);
const client = new Anthropic();

const SYSTEM_PREAMBLE = `Tu es un assistant pour le jeu de rôle « Les Terres d'Arran », qui utilise le moteur Chroniques Oubliées.
Tu t'adresses aux joueurs et au meneur en français.
Les extraits ci-dessous proviennent d'une base interne (knowledge/) : ce n'est PAS une copie complète du livre. Si une règle précise manque ou est incertaine, dis-le clairement et invite à vérifier le livre du joueur officiel.
Ne invente pas de chiffres (bonus, coûts, DD) : si l'information n'est pas dans les extraits, ne la fabrique pas.`;

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

function estimateTokens(text: string): number {
  // Rough heuristic for French/English prose.
  return Math.ceil(text.length / 4);
}

function trimTextToTokenBudget(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return "";
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Contenu tronque pour respecter la limite de tokens.]`;
}

function trimMessagesToBudget(
  history: ChatMessage[],
  maxMessages: number,
  maxTokens: number,
): ChatMessage[] {
  const sliced = history.slice(-Math.max(1, maxMessages));
  const kept: ChatMessage[] = [];
  let used = 0;
  for (let i = sliced.length - 1; i >= 0; i -= 1) {
    const m = sliced[i];
    const tokens = estimateTokens(m.content);
    if (kept.length > 0 && used + tokens > maxTokens) break;
    kept.unshift(m);
    used += tokens;
  }
  return kept.length > 0 ? kept : sliced.slice(-1);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, bundles: listBundles(), defaultBundle: DEFAULT_BUNDLE });
});

app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body as {
      messages?: ChatMessage[];
      topic?: string;
    };
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages[] required" });
      return;
    }
    const bundleId =
      typeof body.topic === "string" && body.topic.length > 0
        ? body.topic
        : DEFAULT_BUNDLE;

    let knowledge: string;
    try {
      knowledge = await loadBundle(bundleId);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load knowledge bundle" });
      return;
    }

    const trimmedKnowledge = trimTextToTokenBudget(knowledge, MAX_KNOWLEDGE_TOKENS);
    const system = `${SYSTEM_PREAMBLE}\n\n## Base de regles (extraits)\n\n${trimmedKnowledge}`;
    const systemTokens = estimateTokens(system);
    const messageBudget = Math.max(500, MAX_INPUT_TOKENS - systemTokens);
    const trimmedMessages = trimMessagesToBudget(
      messages,
      MAX_HISTORY_MESSAGES,
      messageBudget,
    );

    const apiMessages = trimmedMessages.map((m) => ({
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

    const stream = client.messages.stream({
      model: MODEL,
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
