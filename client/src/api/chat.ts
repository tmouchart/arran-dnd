export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

interface StreamDonePayload {
  model: string
  bundle: string
}

interface StreamErrorPayload {
  error?: string
}

export interface StreamChatOptions {
  onDelta: (textDelta: string) => void
  onDone?: (meta: StreamDonePayload) => void
  onError?: (message: string) => void
}

export async function streamChat(
  messages: ChatMessage[],
  options: StreamChatOptions,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg =
      typeof err.error === 'string' ? err.error : res.statusText
    throw new Error(msg || 'Requête échouée')
  }

  if (!res.body) {
    throw new Error('Flux de réponse indisponible')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = ''
  let eventData = ''

  const emit = () => {
    if (!eventName) return
    if (eventName === 'delta') {
      try {
        const parsed = JSON.parse(eventData) as { text?: string }
        if (typeof parsed.text === 'string') {
          options.onDelta(parsed.text)
        }
      } catch {
        // Ignore malformed event chunk
      }
      return
    }
    if (eventName === 'done') {
      try {
        const parsed = JSON.parse(eventData) as StreamDonePayload
        options.onDone?.(parsed)
      } catch {
        // Ignore malformed done event
      }
      return
    }
    if (eventName === 'error') {
      let message = 'Erreur inconnue'
      try {
        const parsed = JSON.parse(eventData) as StreamErrorPayload
        if (typeof parsed.error === 'string' && parsed.error.trim()) {
          message = parsed.error
        }
      } catch {
        // Keep default message
      }
      options.onError?.(message)
      throw new Error(message)
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundaryIndex = buffer.indexOf('\n\n')
    while (boundaryIndex !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex + 2)

      const lines = rawEvent.split('\n')
      eventName = ''
      eventData = ''
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const chunk = line.slice(5).trim()
          eventData = eventData ? `${eventData}\n${chunk}` : chunk
        }
      }

      emit()
      boundaryIndex = buffer.indexOf('\n\n')
    }
  }
}

export async function fetchHealth(): Promise<{
  ok: boolean
  bundles: string[]
}> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error('API indisponible')
  return res.json() as Promise<{ ok: boolean; bundles: string[] }>
}
