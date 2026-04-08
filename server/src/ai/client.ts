import "../loadEnv.js";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export const AI_PROVIDER = process.env.AI_PROVIDER ?? "gemini";
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

/**
 * Generate a simple non-streaming text response from the configured AI provider.
 */
export async function generateText(prompt: string): Promise<string> {
  if (AI_PROVIDER === "gemini") {
    if (!geminiClient) throw new Error("GEMINI_API_KEY manquante.");
    const response = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text ?? "";
  } else {
    if (!anthropicClient) throw new Error("ANTHROPIC_API_KEY manquante.");
    const message = await anthropicClient.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    return block.type === "text" ? block.text : "";
  }
}
