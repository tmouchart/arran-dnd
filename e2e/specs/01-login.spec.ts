import { test, expect } from '../fixtures/test'
import { stateFor } from '../fixtures/auth'

test.describe('connexion', () => {
  test('un visiteur non connecté atterrit sur le login', async ({ page }) => {
    await page.goto('/personnage')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('#username')).toBeVisible()
  })

  test.describe('déjà connecté', () => {
    test.use({ storageState: stateFor('bracco') })

    test('la session survit à un rechargement', async ({ page }) => {
      await page.goto('/personnage')
      await expect(page).not.toHaveURL(/\/login/)
      await page.reload()
      await expect(page).not.toHaveURL(/\/login/)
    })
  })
})
