import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "../auth/middleware.js";

const router = Router();

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Voice style prompt for Isilwen — mystical elvish oracle
const VOICE_STYLE = [
  "Speak in a soft, mystical, enchanting tone.",
  "You are an ancient elvish oracle — wise, slightly ethereal.",
  "Pace: brisk and lively, speak a bit faster than normal, no long pauses.",
  "Accent: elegant, flowing, otherworldly.",
].join(" ");

/**
 * POST /api/tts
 * Body: { text: string }
 * Returns: audio/wav
 */
router.post("/", requireAuth, async (req, res) => {
  if (!geminiClient) {
    res.status(500).json({ error: "GEMINI_API_KEY manquante." });
    return;
  }

  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Le champ 'text' est requis." });
    return;
  }

  // Cap text length to avoid very long TTS calls
  const trimmed = text.slice(0, 5000);

  try {
    const response = await geminiClient.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        {
          parts: [{ text: `${VOICE_STYLE}\n\n${trimmed}` }],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Aoede" },
          },
        },
      },
    });

    // Extract inline audio data from the response
    const audioPart = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData
    );

    if (!audioPart?.inlineData?.data) {
      res.status(500).json({ error: "Aucun audio généré par le modèle." });
      return;
    }

    const pcmBase64 = audioPart.inlineData.data;
    const mimeType = audioPart.inlineData.mimeType || "audio/L16;rate=24000";
    const pcmBuffer = Buffer.from(pcmBase64, "base64");

    // Convert raw PCM to WAV (16-bit mono 24kHz)
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;

    const wavHeader = Buffer.alloc(44);
    wavHeader.write("RIFF", 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write("WAVE", 8);
    wavHeader.write("fmt ", 12);
    wavHeader.writeUInt32LE(16, 16); // chunk size
    wavHeader.writeUInt16LE(1, 20); // PCM format
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write("data", 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

    res.set("Content-Type", "audio/wav");
    res.set("Content-Length", String(wavBuffer.length));
    res.send(wavBuffer);
  } catch (err: any) {
    console.error("[tts] Gemini TTS error:", err?.message || err);
    res.status(500).json({ error: "Erreur lors de la génération audio." });
  }
});

export default router;
