import { test, expect } from '../fixtures/test'
import { stateFor } from '../fixtures/auth'

test.use({ storageState: stateFor('bracco') })

test('le journal de bord garde ce qu\'on écrit', async ({ page }) => {
  await page.goto('/journal')

  const editor = page.getByTestId('mention-editor')
  await expect(editor).toBeVisible()

  const texte = `Note de test ${Date.now()}`
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await editor.pressSequentially(texte)

  // L'indicateur de sauvegarde est la seule preuve visible côté joueur.
  await expect(page.getByText('Sauvegardé ✓')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('mention-editor')).toHaveText(texte)
})
