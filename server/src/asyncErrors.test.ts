import { describe, expect, it } from 'vitest'
import express from 'express'
import 'express-async-errors'
import type { AddressInfo } from 'node:net'

// Vérifie le filet de sécurité d'index.ts : en Express 4, un handler async qui
// rejette doit finir en 500 via le middleware d'erreur, pas en crash du process.
function startApp(): Promise<{ url: string; close: () => void }> {
  const app = express()

  app.get('/boom', async () => {
    throw new Error('DB down')
  })

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return
    res.status(500).json({ error: 'Erreur serveur' })
  })

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
  })
}

describe('gestion des erreurs async', () => {
  it('renvoie 500 quand un handler async rejette, sans tuer le process', async () => {
    const { url, close } = await startApp()
    try {
      const res = await fetch(`${url}/boom`)
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Erreur serveur' })
    } finally {
      close()
    }
  })
})
