import { test as base, expect } from '@playwright/test'

/**
 * Test de base : coupe les appels IA et TTS.
 * Ils sont lents, coûteux et non déterministes — aucun happy path n'en dépend.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    for (const route of ['**/api/chat**', '**/api/tts/**', '**/api/images/generate**']) {
      await page.route(route, (r) => r.abort())
    }
    await use(page)
  },
})

export { expect }
