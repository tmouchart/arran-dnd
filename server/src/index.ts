import "./loadEnv.js";
import { runMigrations } from "./db/runMigrations.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import authRouter from "./routes/auth.js";
import charactersRouter from "./routes/characters.js";
import { loadCoreIndex, loadTopic } from "./knowledge/loadKnowledge.js";
import { CLIENT_DIST } from "./paths.js";
import {
  anthropicTool,
  geminiTool,
  TOPIC_NAMES,
  type TopicName,
} from "./knowledge/tools.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/characters", charactersRouter);

const AI_PROVIDER = process.env.AI_PROVIDER ?? "gemini";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
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
- Si un personnage actif est fourni dans le contexte, adresse-toi à lui par son prénom et adapte tes conseils à sa race, son profil, ses capacités et son niveau.

⚡ Concision avant tout :
- Réponds de façon directe et concise. Va à l'essentiel sans tourner autour du pot.
- Utilise les émojis quand ils ajoutent de la clarté ou de la lisibilité (listes, catégories, points importants).
- Évite les longues introductions, les répétitions et les formules creuses. Une bonne réponse est courte et utile.
- Structure : info utile d'abord, couleur narrative ensuite — jamais l'inverse.

📖 Rigueur règles :
- Les extraits proviennent d'une base interne (knowledge/) : ce n'est PAS une copie complète du livre.
- Si une règle manque ou est incertaine, dis-le en une phrase, propose de vérifier le livre officiel, puis donne une alternative prudente.
- N'invente pas de chiffres (bonus, coûts, DD) : si l'info n'est pas dans les extraits, ne la fabrique pas.
- Tu as accès à un outil load_knowledge pour charger des règles détaillées. Utilise-le dès qu'une question porte sur un sujet spécifique (races, combat, magie, voies, équipement, création de personnage, monde...).`;

type ChatMessage = { role: "user" | "assistant"; content: string };
type SseEvent = "delta" | "done" | "error" | "tool_use";

function writeSse(res: express.Response, event: SseEvent, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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
  const defense = c.defense ?? "?";
  const abilities = (c.abilities as Record<string, number> | undefined) ?? {};
  const str = abilities.strength ?? "?";
  const dex = abilities.dexterity ?? "?";
  const con = abilities.constitution ?? "?";
  const int_ = abilities.intelligence ?? "?";
  const wis = abilities.wisdom ?? "?";
  const cha = abilities.charisma ?? "?";
  const paths = (c.paths as Array<{ name: string; rank: number }> | undefined) ?? [];
  const skills = (c.skills as Array<{ name: string; rank: number }> | undefined) ?? [];

  const pathsStr = paths.length > 0
    ? paths.map((p) => `${p.name} (rang ${p.rank})`).join(", ")
    : "aucune";
  const skillsStr = skills.length > 0
    ? skills.map((s) => `${s.name} (rang ${s.rank})`).join(", ")
    : "aucune";

  return `## Personnage actif

Tu t'adresses à **${name}**${people ? `, ${people}` : ""}${profile ? `, profil ${profile}` : ""}, niveau ${level}.
Stats : FOR ${str} / DEX ${dex} / CON ${con} / INT ${int_} / SAG ${wis} / CHA ${cha}
PV max ${hpMax} | PM max ${mpMax} | Défense ${defense}
Voies : ${pathsStr}
Compétences : ${skillsStr}

👤 Adresse-toi toujours à ce personnage par son prénom. Adapte tes réponses à sa race, son profil et ses capacités.`;
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

app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body as { messages?: ChatMessage[]; character?: CharacterPayload };
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages[] required" });
      return;
    }

    const character = body.character ?? null;
    const index = await loadCoreIndex();
    const characterSection = character ? `\n\n${buildCharacterSection(character)}` : "";
    const system = `${SYSTEM_PREAMBLE}${characterSection}\n\n## Index des sujets disponibles\n\n${index}`;

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

      // Turn 1 — streaming: text is emitted live, tool call detected at the end
      const turn1AllParts: GeminiPart[] = [];
      let turn1LastUsage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;

      const turn1Stream = await geminiClient.models.generateContentStream({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: system,
          tools: [geminiTool],
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      for await (const chunk of turn1Stream) {
        if (closed) break;
        if (chunk.usageMetadata) turn1LastUsage = chunk.usageMetadata;
        const parts = (chunk.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
        turn1AllParts.push(...parts);
        const text = typeof chunk.text === "string" ? chunk.text : "";
        if (text) writeSse(res, "delta", { text });
      }

      logTokens("gemini turn1", {
        input: turn1LastUsage?.promptTokenCount,
        output: turn1LastUsage?.candidatesTokenCount,
        total: turn1LastUsage?.totalTokenCount,
      });

      const funcCall = turn1AllParts.find((p) => p.functionCall != null);
      if (funcCall?.functionCall) {
        const fc = funcCall.functionCall as { args?: { topic?: string } };
        const rawTopic = fc.args?.topic ?? "";
        if ((TOPIC_NAMES as readonly string[]).includes(rawTopic)) {
          calledTopic = rawTopic as TopicName;
        }
      }

      if (funcCall?.functionCall && !calledTopic && !closed) {
        const raw =
          (funcCall.functionCall as { args?: { topic?: string } }).args?.topic ?? "";
        console.error(`[knowledge] load_knowledge ignored unknown topic: "${raw}"`);
        writeSse(res, "error", {
          error:
            "Le serveur ne reconnaît pas ce sujet de règles. Recharge la page et réessaie.",
        });
        res.end();
        return;
      }

      if (calledTopic && !closed) {
        console.log(`[knowledge] AI requested topic: "${calledTopic}" (gemini)`);
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

        contents = [
          ...contents,
          {
            role: "model",
            parts: [{ functionCall: { name: "load_knowledge", args: { topic: calledTopic } } }],
          },
          {
            role: "user",
            parts: [{ functionResponse: { name: "load_knowledge", response: { content: knowledgeText } } }],
          },
        ];

        // Turn 2 — streaming final answer
        let lastUsage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
        const stream2 = await geminiClient.models.generateContentStream({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: system,
            tools: [geminiTool],
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        for await (const chunk of stream2) {
          if (closed) break;
          if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
          const text = typeof chunk.text === "string" ? chunk.text : "";
          if (text) writeSse(res, "delta", { text });
        }
        logTokens("gemini turn2", {
          input: lastUsage?.promptTokenCount,
          output: lastUsage?.candidatesTokenCount,
          total: lastUsage?.totalTokenCount,
        });
      } else {
        console.log("[knowledge] No tool call — answering from core index (gemini)");
      }

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
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(join(CLIENT_DIST, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

const PORT = Number(process.env.PORT) || 3001;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    await runMigrations(databaseUrl);
  }
  app.listen(PORT, () => {
    console.log(`arran-dnd API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
