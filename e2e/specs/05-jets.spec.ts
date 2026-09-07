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

// Le dé d'un autre joueur roule aussi chez moi : son nom s'affiche sous le
// petit dé en haut de l'écran. Le toggle de la barre du bas coupe l'affichage.
test('le dé d’un autre joueur roule chez le MJ, sauf si le MJ le coupe', async ({ browser }) => {
  const mj = await browser.newContext({ storageState: stateFor('mj-dev') })
  const joueur = await browser.newContext({ storageState: stateFor('bracco') })
  const pageMj = await mj.newPage()
  const pageJoueur = await joueur.newPage()

  try {
    await pageMj.goto('/personnage')
    await pageJoueur.goto('/personnage')
    await pageJoueur.getByTitle('Lancer des dés').click()

    await pageJoueur.getByTestId('die-d20').click()
    await expect(pageMj.getByTestId('remote-die-label')).toContainText('Bracco Pouce-Cassé', {
      timeout: 15_000,
    })

    // Toggle OFF : le jet suivant n'affiche plus de dé distant, mais arrive
    // toujours dans le log.
    await pageMj.getByTestId('nav-remote-dice').click()
    await expect(pageMj.getByTestId('remote-die-label')).toHaveCount(0, { timeout: 5_000 })
    await pageMj.getByTitle('Historique des jets').click()
    const before = await pageMj.getByTestId('roll-log-entry').count()

    await pageJoueur.getByTestId('die-d20').click()
    await expect(pageMj.getByTestId('roll-log-entry')).toHaveCount(before + 1, { timeout: 15_000 })
    await expect(pageMj.getByTestId('remote-die-label')).toHaveCount(0)
  } finally {
    await mj.close()
    await joueur.close()
  }
})
