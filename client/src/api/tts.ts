/**
 * Calls the TTS endpoint and returns a playable audio Blob URL.
 * The caller is responsible for revoking the URL when done.
 */
export async function fetchTts(text: string): Promise<string> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Erreur TTS"
    );
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
