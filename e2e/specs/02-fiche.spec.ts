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

// Régression prod (sept. 2026) : le bac à sable seed des persos niveau 5 sans
// jets de croissance. Au chargement, un premier calcul de PV max avec 0 jet
// rabattait les PV courants (48 → 11) avant que les jets par défaut soient
// ajoutés. Le joueur voyait ses PV fondre à chaque ouverture de la fiche.
test('les PV courants ne sont pas rabattus au chargement de la fiche', async ({ page }) => {
  await page.goto('/personnage')
  // Bracco est seedé à 48/48 (server/src/dev/seed.ts).
  await expect(page.getByTestId('hp-current')).toHaveText('48')
})

// Régression prod (août 2026) : le serveur jetait les jets de croissance à
// chaque sauvegarde (liste blanche anti mass-assignment incomplète).
test('un jet de croissance modifié survit à un rechargement', async ({ page }) => {
  await page.goto('/personnage')
  await page.getByTestId('hp-growth-open').click()
  const input = page.getByTestId('hp-growth-input-2')
  await expect(input).toBeVisible()

  const saved = page.waitForResponse(
    (r) => /\/api\/characters\/\d+$/.test(r.url()) && r.request().method() === 'PUT' && r.ok()
  )
  await input.fill('3')
  await input.blur()
  await saved

  await page.reload()
  await page.getByTestId('hp-growth-open').click()
  await expect(page.getByTestId('hp-growth-input-2')).toHaveValue('3')
})
