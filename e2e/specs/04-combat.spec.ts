import { test, expect, type Page } from '../fixtures/test'
import { stateFor } from '../fixtures/auth'

/** Le participant dont c'est le tour. On compare des id : deux monstres peuvent porter le même nom. */
function tourEnCours(page: Page) {
  return page.getByTestId('active-participant')
}

function idDuTour(page: Page) {
  return tourEnCours(page).getAttribute('data-participant-id')
}

test('le MJ lance un combat et le joueur suit le même tour', async ({ browser }) => {
  const mj = await browser.newContext({ storageState: stateFor('mj-dev') })
  const joueur = await browser.newContext({ storageState: stateFor('bracco') })
  const pageMj = await mj.newPage()
  const pageJoueur = await joueur.newPage()

  try {
    // ── Le MJ lance le combat depuis la rencontre du bac à sable ──
    await pageMj.goto('/campagnes')
    await pageMj.getByText('Bac à sable').first().click()
    await pageMj.getByRole('tab', { name: 'Rencontres' }).click()
    await pageMj.getByRole('button', { name: 'Jouer' }).click()

    // "Combat vide" est la première option : on prend la rencontre seedée.
    const select = pageMj.locator('select')
    await select.selectOption({ index: 1 })
    await pageMj.getByRole('button', { name: 'Lancer !' }).click()

    await expect(pageMj).toHaveURL(/\/combat\/\d+$/)
    const urlCombat = pageMj.url()

    // L'ordre d'initiative est calculé côté serveur : la timeline doit être pleine.
    await expect(pageMj.getByTestId('active-participant')).toHaveCount(1)
    const tourInitial = await idDuTour(pageMj)

    // ── Le joueur rejoint et voit le même tour ──
    await pageJoueur.goto(urlCombat)
    await expect(tourEnCours(pageJoueur)).toHaveAttribute('data-participant-id', tourInitial!)

    // ── Le MJ passe au suivant, le joueur suit en direct (SSE) ──
    await pageMj.getByRole('button', { name: 'Suivant' }).click()
    await expect(tourEnCours(pageMj)).not.toHaveAttribute('data-participant-id', tourInitial!)
    const tourSuivant = await idDuTour(pageMj)
    await expect(tourEnCours(pageJoueur)).toHaveAttribute('data-participant-id', tourSuivant!)

    // On ne laisse pas un combat actif derrière nous : les autres specs le verraient.
    await pageMj.getByRole('button', { name: 'Terminer' }).click()
    await pageMj.getByRole('dialog').getByRole('button', { name: 'Terminer' }).click()
    await expect(pageMj.getByTestId('active-participant')).toHaveCount(0)
  } finally {
    await mj.close()
    await joueur.close()
  }
})
