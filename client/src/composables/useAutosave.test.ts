import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { backoffDelay, useAutosave } from './useAutosave'

describe('backoffDelay', () => {
  it('double à chaque tentative', () => {
    expect(backoffDelay(1)).toBe(1000)
    expect(backoffDelay(2)).toBe(2000)
    expect(backoffDelay(3)).toBe(4000)
  })

  it('plafonne pour ne pas attendre indéfiniment', () => {
    expect(backoffDelay(50)).toBe(15_000)
  })
})

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('regroupe les frappes rapprochées en une seule sauvegarde', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { schedule } = useAutosave<string>(save)

    schedule('a')
    schedule('ab')
    schedule('abc')
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('abc')
  })

  it('conserve le texte et réessaie après un échec', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('423'))
      .mockResolvedValue(undefined)
    const { schedule, status } = useAutosave<string>(save)

    schedule('texte précieux')
    await vi.advanceTimersByTimeAsync(800)
    expect(status.value).toBe('error')

    // Le texte n'est pas jeté : le réessai le renvoie tel quel.
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('texte précieux')
    expect(status.value).toBe('saved')
  })

  it('réessaie avec la dernière version tapée, pas celle qui a échoué', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined)
    const { schedule } = useAutosave<string>(save)

    schedule('v1')
    await vi.advanceTimersByTimeAsync(800)
    schedule('v2')
    await vi.advanceTimersByTimeAsync(1000)

    expect(save).toHaveBeenLastCalledWith('v2')
  })

  it('signale un contenu non sauvegardé tant que le serveur ne répond pas', async () => {
    const save = vi.fn().mockRejectedValue(new Error('hors ligne'))
    const { schedule, hasPending } = useAutosave<string>(save)

    schedule('jamais parti')
    await vi.advanceTimersByTimeAsync(800)
    expect(hasPending.value).toBe(true)
  })

  it('envoie immédiatement sur flush, sans attendre le debounce', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { schedule, flush } = useAutosave<string>(save)

    schedule('à plat')
    await flush()
    expect(save).toHaveBeenCalledWith('à plat')
  })

  it('ne sauvegarde pas ce qui a déjà été envoyé', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { schedule, flush } = useAutosave<string>(save)

    schedule('une fois')
    await vi.advanceTimersByTimeAsync(800)
    await flush()
    expect(save).toHaveBeenCalledTimes(1)
  })
})
