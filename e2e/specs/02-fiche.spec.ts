import { test, expect } from '../fixtures/test'
import { stateFor } from '../fixtures/auth'

test.use({ storageState: stateFor('bracco') })

test.describe('fiche de personnage', () => {
  test('les PV modifiés survivent à un rechargement', async ({ page }) => {
    await page.goto('/personnage')

    const hp = page.getByTestId('hp-current')
    await expect(hp).toBeVisible()
    const before = Number(await hp.innerText())

    // La sauvegarde est debouncée : on attend le vrai PUT plutôt qu'un timer.
    const saved = page.waitForResponse(
      (r) => /\/api\/characters\/\d+$/.test(r.url()) && r.request().method() === 'PUT' && r.ok()
    )
    await page.getByTestId('hp-minus').click()
    await expect(hp).toHaveText(String(before - 1))
    await saved

    await page.reload()
    await expect(page.getByTestId('hp-current')).toHaveText(String(before - 1))

    // On remet la fiche comme on l'a trouvée : les specs partagent la base.
    const restored = page.waitForResponse(
      (r) => /\/api\/characters\/\d+$/.test(r.url()) && r.request().method() === 'PUT' && r.ok()
    )
    await page.getByTestId('hp-plus').click()
    await restored
  })
})
