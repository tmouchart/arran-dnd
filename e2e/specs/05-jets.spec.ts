import { test, expect } from '../fixtures/test'
import { stateFor } from '../fixtures/auth'

// Le jet d'un joueur doit remonter en direct dans le log de la campagne côté MJ.
test('un jet de dé arrive dans le log du MJ', async ({ browser }) => {
  const mj = await browser.newContext({ storageState: stateFor('mj-dev') })
  const joueur = await browser.newContext({ storageState: stateFor('bracco') })
  const pageMj = await mj.newPage()
  const pageJoueur = await joueur.newPage()

  try {
    await pageMj.goto('/personnage')
    await pageMj.getByTitle('Historique des jets').click()
    await expect(pageMj.getByTestId('roll-log')).toBeVisible()

    await pageJoueur.goto('/personnage')
    await pageJoueur.getByTitle('Lancer des dés').click()
    await pageJoueur.getByTestId('die-d20').click()

    // Le flux SSE pousse le jet : aucun rechargement côté MJ.
    await expect(
      pageMj.getByTestId('roll-log').getByText('Bracco Pouce-Cassé').first()
    ).toBeVisible({ timeout: 15_000 })
  } finally {
    await mj.close()
    await joueur.close()
  }
})
