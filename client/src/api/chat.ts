export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatResponse {
  text: string
  model: string
  bundle: string
}

export async function sendChat(
  messages: ChatMessage[],
  topic: string,
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, topic }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg =
      typeof err.error === 'string' ? err.error : res.statusText
    throw new Error(msg || 'Requête échouée')
  }
  return res.json() as Promise<ChatResponse>
}

export async function fetchHealth(): Promise<{
  ok: boolean
  bundles: string[]
}> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error('API indisponible')
  return res.json() as Promise<{ ok: boolean; bundles: string[] }>
}
