import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KNOWLEDGE_DIR } from "../paths.js";
import { BUNDLES, DEFAULT_BUNDLE } from "./bundles.js";

export async function loadBundle(bundleId: string): Promise<string> {
  const id = BUNDLES[bundleId] ? bundleId : DEFAULT_BUNDLE;
  const files = BUNDLES[id];
  const parts: string[] = [];
  for (const rel of files) {
    const full = join(KNOWLEDGE_DIR, rel);
    const text = await readFile(full, "utf8");
    parts.push(`### File: ${rel}\n\n${text}`);
  }
  return parts.join("\n\n---\n\n");
}
