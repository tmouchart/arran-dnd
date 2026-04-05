/**
 * Calls the TTS endpoint and returns a raw ArrayBuffer (WAV).
 * Supports AbortSignal for cancellation.
 */
export async function fetchTtsBuffer(
  text: string,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Erreur TTS"
    );
  }

  return res.arrayBuffer();
}
