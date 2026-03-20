import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KNOWLEDGE_DIR } from "../paths.js";
import { TOPIC_NAMES, type TopicName } from "./tools.js";

export async function loadCoreIndex(): Promise<string> {
  const full = join(KNOWLEDGE_DIR, "topics/00-index.md");
  return readFile(full, "utf8");
}

export async function loadTopic(name: TopicName): Promise<string> {
  if (!(TOPIC_NAMES as readonly string[]).includes(name)) {
    throw new Error(`Unknown topic: ${name}`);
  }
  const full = join(KNOWLEDGE_DIR, `topics/${name}.md`);
  return readFile(full, "utf8");
}
