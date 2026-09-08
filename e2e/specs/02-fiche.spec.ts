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

// Régression prod (sept. 2026) : quand il manquait des jets de croissance
// (niveau 5 avec 3 jets), un premier calcul de PV max rabattait les PV
// courants avant que le jet manquant soit ajouté. On reproduit l'état prod en
// amputant Bracco d'un jet par l'API, puis on ouvre la fiche.
test('les PV courants ne sont pas rabattus au chargement de la fiche', async ({ page }) => {
  const chars = await (await page.request.get('/api/characters')).json()
  const bracco = chars.find((c: { isActive: boolean }) => c.isActive)
  const seeded: number[] = bracco.hpLevelGains // [7, 5, 6, 5], cf. server/src/dev/seed.ts

  await page.request.put(`/api/characters/${bracco.id}`, { data: { hpLevelGains: seeded.slice(0, -1) } })
  try {
    await page.goto('/personnage')
    await expect(page.getByTestId('hp-current')).toHaveText(String(bracco.hpCurrent))
  } finally {
    await page.request.put(`/api/characters/${bracco.id}`, { data: { hpLevelGains: seeded, hpCurrent: bracco.hpCurrent } })
  }
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
