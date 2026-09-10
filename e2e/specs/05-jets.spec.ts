import type { Locator } from '@playwright/test'
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

// Concentration (magie.md) : le sort passe en action limitée et gagne un
// bonus. Économe retire 2 PM ; puissante monte les dés d'une catégorie.
test('un mage se concentre : économe coûte 2 PM de moins, puissante monte les dés', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: stateFor('orlane') })
  const page = await ctx.newPage()

  try {
    await page.goto('/actions')
    const carte = page.locator('.action-bubble', { hasText: 'Boule de feu' })
    await expect(carte).toBeVisible()
    await expect(carte.getByTestId('action-pm-badge')).toHaveText('PM:4')
    await expect(carte.getByTestId('action-type-badge')).toHaveText('Attaque')
    await expect(page.getByTestId('pm-current')).toHaveText('10')

    // Économe : −2 PM, action limitée.
    await carte.getByTestId('concentration-econome').click()
    await expect(carte.getByTestId('action-pm-badge')).toHaveText('PM:2')
    await expect(carte.getByTestId('action-type-badge')).toHaveText('Limitée')

    await carte.getByTestId('action-roll').click()
    await expect(page.getByTestId('pm-current')).toHaveText('8')
    // Le choix ne survit pas à l'incantation.
    await expect(carte.getByTestId('action-pm-badge')).toHaveText('PM:4')

    // Puissante : 4d6 → 4d8 dans la description.
    await carte.getByTestId('concentration-puissante').click()
    await expect(carte.getByTestId('action-description')).toContainText('4d8')
  } finally {
    await ctx.close()
  }
})

/*
 * Avantage permanent (plan 23) : Nym a « Dextérité héroïque » (acrobatie rang 5),
 * donc +2 en DEX et 2d20 gardés au meilleur sur les tests de DEX.
 * Bracco n'a aucun passif : c'est le témoin de non-régression.
 *
 * Un jet est aléatoire : on ne teste que des invariants (combien de dés,
 * lequel est barré, comment le total se compose), jamais une valeur précise.
 */

interface JetLu {
  total: number
  kept: number
  dropped: number[]
  bonus: number
}

/** Lit une carte de résultat de jet : le total, le dé gardé, les dés barrés. */
async function lireJet(zone: Locator): Promise<JetLu> {
  const brut = ((await zone.textContent()) ?? '').replace(/\s+/g, ' ')
  // "Test DEX : 22 (d20 = 17 4 +5)"
  const m = brut.match(/:\s*(-?\d+)\s*\(d\d+ = (\d+)((?: \d+)*) ([+-]\d+)\)/)
  if (!m) throw new Error(`Résultat de jet illisible : ${brut}`)
  const dropped = m[3].trim() === '' ? [] : m[3].trim().split(' ').map(Number)
  // Le nombre de dés barrés doit être cohérent avec ce que le DOM marque.
  expect(await zone.getByTestId('roll-dropped').count()).toBe(dropped.length)
  return { total: Number(m[1]), kept: Number(m[2]), dropped, bonus: Number(m[4]) }
}

test("la fiche montre le score bonifié et l'avantage du passif", async ({ browser }) => {
  const avecPassif = await browser.newContext({ storageState: stateFor('nym') })
  const sansPassif = await browser.newContext({ storageState: stateFor('bracco') })
  const pageNym = await avecPassif.newPage()
  const pageBracco = await sansPassif.newPage()

  try {
    await pageNym.goto('/personnage')
    // DEX 18 de base + 2 de Dextérité héroïque.
    await expect(pageNym.getByTestId('ability-score-dexterity')).toHaveText('20')
    await expect(pageNym.getByTestId('ability-bonus-mark-dexterity')).toBeVisible()
    await expect(pageNym.getByTestId('ability-advantage-dexterity')).toBeVisible()
    // Une carac qu'aucun passif ne touche reste nue.
    await expect(pageNym.getByTestId('ability-score-strength')).toHaveText('9')
    await expect(pageNym.getByTestId('ability-bonus-mark-strength')).toHaveCount(0)
    await expect(pageNym.getByTestId('ability-advantage-strength')).toHaveCount(0)

    await pageBracco.goto('/personnage')
    await expect(pageBracco.getByTestId('ability-score-dexterity')).toHaveText('12')
    await expect(pageBracco.getByTestId('ability-bonus-mark-dexterity')).toHaveCount(0)
    await expect(pageBracco.getByTestId('ability-advantage-dexterity')).toHaveCount(0)
  } finally {
    await avecPassif.close()
    await sansPassif.close()
  }
})

test('un test de DEX avec avantage lance deux dés et garde le meilleur', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: stateFor('nym') })
  const page = await ctx.newPage()

  try {
    await page.goto('/actions')
    await page.getByTestId('ability-test-dexterity').click()

    // L'animation 3D précède la révélation : on attend le résultat, pas un délai.
    const zone = page.getByTestId('ability-roll-result')
    await expect(zone).toBeVisible({ timeout: 20_000 })
    await expect(zone.getByTestId('roll-dropped')).toHaveCount(1)

    const jet = await lireJet(zone)
    expect(jet.dropped).toHaveLength(1)
    // Le dé gardé est le meilleur des deux, et c'est lui qui fait le total.
    expect(jet.kept).toBeGreaterThanOrEqual(jet.dropped[0])
    expect(jet.total).toBe(jet.kept + jet.bonus)
    // DEX 20 → Mod. +5, calculé sur le score bonifié.
    expect(jet.bonus).toBe(5)
    for (const d of [jet.kept, ...jet.dropped]) {
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(20)
    }
  } finally {
    await ctx.close()
  }
})

test('sans passif, ou sur une autre carac, un seul dé est lancé', async ({ browser }) => {
  const sansPassif = await browser.newContext({ storageState: stateFor('bracco') })
  const avecPassif = await browser.newContext({ storageState: stateFor('nym') })
  const pageBracco = await sansPassif.newPage()
  const pageNym = await avecPassif.newPage()

  try {
    await pageBracco.goto('/actions')
    await pageBracco.getByTestId('ability-test-dexterity').click()
    const zoneBracco = pageBracco.getByTestId('ability-roll-result')
    await expect(zoneBracco).toBeVisible({ timeout: 20_000 })
    await expect(zoneBracco.getByTestId('roll-dropped')).toHaveCount(0)
    const jetBracco = await lireJet(zoneBracco)
    expect(jetBracco.dropped).toHaveLength(0)
    expect(jetBracco.total).toBe(jetBracco.kept + jetBracco.bonus)

    // L'avantage ne déborde pas sur les autres caractéristiques.
    await pageNym.goto('/actions')
    await pageNym.getByTestId('ability-test-strength').click()
    const zoneNym = pageNym.getByTestId('ability-roll-result')
    await expect(zoneNym).toBeVisible({ timeout: 20_000 })
    await expect(zoneNym.getByTestId('roll-dropped')).toHaveCount(0)
  } finally {
    await sansPassif.close()
    await avecPassif.close()
  }
})

test("le log de campagne du MJ montre les deux dés de l'avantage", async ({ browser }) => {
  const mj = await browser.newContext({ storageState: stateFor('mj-dev') })
  const joueur = await browser.newContext({ storageState: stateFor('nym') })
  const pageMj = await mj.newPage()
  const pageJoueur = await joueur.newPage()

  try {
    await pageMj.goto('/personnage')
    await pageMj.getByTitle('Historique des jets').click()
    await expect(pageMj.getByTestId('roll-log')).toBeVisible()
    const avant = await pageMj.getByTestId('roll-log-entry').count()

    await pageJoueur.goto('/actions')
    await pageJoueur.getByTestId('ability-test-dexterity').click()
    const zone = pageJoueur.getByTestId('ability-roll-result')
    await expect(zone).toBeVisible({ timeout: 20_000 })
    const jet = await lireJet(zone)

    // Le jet traverse le réseau : le MJ doit voir le dé gardé ET le dé écarté.
    await expect(pageMj.getByTestId('roll-log-entry')).toHaveCount(avant + 1, { timeout: 20_000 })
    await expect
      .poll(
        async () => {
          for (const entree of await pageMj.getByTestId('roll-log-entry').all()) {
            const barres = (await entree.getByTestId('roll-log-dropped').allTextContents())
              .map((t) => t.trim())
            const texte = ((await entree.textContent()) ?? '').replace(/\s+/g, ' ')
            if (barres.includes(String(jet.dropped[0])) && texte.includes(`= ${jet.kept}`)) return true
          }
          return false
        },
        { timeout: 20_000 },
      )
      .toBe(true)
  } finally {
    await mj.close()
    await joueur.close()
  }
})
