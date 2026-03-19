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
const client = new Anthropic();

const SYSTEM_PREAMBLE = `Tu es un assistant pour le jeu de rôle « Les Terres d'Arran », qui utilise le moteur Chroniques Oubliées.
Tu t'adresses aux joueurs et au meneur en français.
Les extraits ci-dessous proviennent d'une base interne (knowledge/) : ce n'est PAS une copie complète du livre. Si une règle précise manque ou est incertaine, dis-le clairement et invite à vérifier le livre du joueur officiel.
Ne invente pas de chiffres (bonus, coûts, DD) : si l'information n'est pas dans les extraits, ne la fabrique pas.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

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

    const system = `${SYSTEM_PREAMBLE}\n\n## Base de règles (extraits)\n\n${knowledge}`;

    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: apiMessages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text =
      textBlock && textBlock.type === "text" ? textBlock.text : "";

    res.json({
      text,
      model: response.model,
      usage: response.usage,
      bundle: listBundles().includes(bundleId) ? bundleId : DEFAULT_BUNDLE,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Chat request failed",
    });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`arran-dnd API listening on http://localhost:${PORT}`);
});
