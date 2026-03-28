import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadChatMessages, saveChatMessages, CHAT_STORAGE_KEY } from './useChatHistory'

// ── Mock localStorage ────────────────────────────────────────────────────────

const store: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]
  vi.clearAllMocks()
})

// ── loadChatMessages ─────────────────────────────────────────────────────────

describe('loadChatMessages', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadChatMessages()).toEqual([])
  })

  it('returns empty array for empty string', () => {
    store[CHAT_STORAGE_KEY] = ''
    expect(loadChatMessages()).toEqual([])
  })

  it('parses valid chat messages', () => {
    const msgs = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ]
    store[CHAT_STORAGE_KEY] = JSON.stringify(msgs)
    expect(loadChatMessages()).toEqual(msgs)
  })

  it('returns empty array for invalid JSON', () => {
    store[CHAT_STORAGE_KEY] = '{broken'
    expect(loadChatMessages()).toEqual([])
  })

  it('returns empty array if data is not an array', () => {
    store[CHAT_STORAGE_KEY] = JSON.stringify({ role: 'user', content: 'test' })
    expect(loadChatMessages()).toEqual([])
  })

  it('returns empty array if any message has invalid role', () => {
    const msgs = [
      { role: 'user', content: 'ok' },
      { role: 'system', content: 'bad role' },
    ]
    store[CHAT_STORAGE_KEY] = JSON.stringify(msgs)
    expect(loadChatMessages()).toEqual([])
  })

  it('returns empty array if any message has non-string content', () => {
    const msgs = [{ role: 'user', content: 123 }]
    store[CHAT_STORAGE_KEY] = JSON.stringify(msgs)
    expect(loadChatMessages()).toEqual([])
  })
})

// ── saveChatMessages ─────────────────────────────────────────────────────────

describe('saveChatMessages', () => {
  it('removes key when messages array is empty', () => {
    store[CHAT_STORAGE_KEY] = 'old'
    saveChatMessages([])
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(CHAT_STORAGE_KEY)
  })

  it('stores JSON when messages are present', () => {
    const msgs = [{ role: 'user' as const, content: 'test' }]
    saveChatMessages(msgs)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      CHAT_STORAGE_KEY,
      JSON.stringify(msgs),
    )
  })

  it('does not throw when localStorage.setItem throws (quota)', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() =>
      saveChatMessages([{ role: 'user', content: 'big data' }]),
    ).not.toThrow()
  })
})
