import { watch, onBeforeUnmount, type Ref } from "vue";
import type { ChatMessage } from "../api/chat";

export const CHAT_STORAGE_KEY = "arran-chat-messages";

const DEBOUNCE_MS = 250;

function isChatMessage(x: unknown): x is ChatMessage {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    (o.role === "user" || o.role === "assistant") &&
    typeof o.content === "string"
  );
}

function parseStoredMessages(data: unknown): ChatMessage[] {
  if (!Array.isArray(data)) return [];
  const out: ChatMessage[] = [];
  for (const item of data) {
    if (!isChatMessage(item)) return [];
    out.push(item);
  }
  return out;
}

export function loadChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw == null || raw === "") return [];
    const parsed: unknown = JSON.parse(raw);
    return parseStoredMessages(parsed);
  } catch {
    return [];
  }
}

export function saveChatMessages(messages: ChatMessage[]): void {
  try {
    if (messages.length === 0) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Quota or private mode — do not break the UI
  }
}

export function useChatPersistence(messages: Ref<ChatMessage[]>): void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(
    messages,
    () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        saveChatMessages(messages.value);
      }, DEBOUNCE_MS);
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer);
    saveChatMessages(messages.value);
  });
}
