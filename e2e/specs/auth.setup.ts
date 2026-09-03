import { test as setup, expect } from '@playwright/test'
import { ROLES, stateFor } from '../fixtures/auth'
import { SEED_PASSWORD } from '../env'

// Une vraie connexion par le formulaire, puis on garde le cookie.
// Les autres specs démarrent donc déjà connectées.
for (const role of ROLES) {
  setup(`connexion ${role}`, async ({ page }) => {
    await page.goto('/login')
    await page.fill('#username', role)
    await page.fill('#password', SEED_PASSWORD)
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()

    await expect(page).not.toHaveURL(/\/login/)
    await page.context().storageState({ path: stateFor(role) })
  })
}
