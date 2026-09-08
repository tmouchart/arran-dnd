import { test, expect } from '../fixtures/test'
import { stateFor } from '../fixtures/auth'

test.describe('style de dé', () => {
  test.use({ storageState: stateFor('bracco') })

  test('un modèle choisi survit au rechargement', async ({ page }) => {
    await page.goto('/options')

    const preset = page.getByTestId('dice-preset-ocean')
    await expect(preset).toBeVisible()

    // La sauvegarde est débouncée : on attend la requête, pas un délai.
    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/auth/me') && r.request().method() === 'PATCH' && r.ok(),
    )
    await preset.click()
    await saved

    await page.reload()
    await expect(page.getByTestId('dice-preset-ocean')).toHaveClass(/active/)
    // Océan est un dégradé : le second ton et l'angle sont donc réglables.
    await expect(page.getByTestId('dice-bg-to')).toBeVisible()
    await expect(page.getByTestId('dice-bg-angle')).toBeVisible()
  })

  test('une police choisie survit au rechargement', async ({ page }) => {
    await page.goto('/options')

    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/auth/me') && r.request().method() === 'PATCH' && r.ok(),
    )
    await page.getByTestId('dice-font').selectOption('uncial')
    await saved

    await page.reload()
    await expect(page.getByTestId('dice-font')).toHaveValue('uncial')
  })

  test('une couleur libre se choisit au clavier dans la feuille', async ({ page }) => {
    await page.goto('/options')

    await page.getByTestId('dice-bg-from').click()
    const hex = page.getByTestId('dice-picker-hex')
    await expect(hex).toBeVisible()

    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/auth/me') && r.request().method() === 'PATCH' && r.ok(),
    )
    await hex.fill('#123456')
    await saved

    await page.reload()
    await page.getByTestId('dice-bg-from').click()
    await expect(page.getByTestId('dice-picker-hex')).toHaveValue('#123456')
  })
})
