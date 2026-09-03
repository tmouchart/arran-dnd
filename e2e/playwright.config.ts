import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, E2E_DATABASE_URL, E2E_PORT } from './env'

const CI = !!process.env.CI

export default defineConfig({
  testDir: './specs',
  // Les specs écrivent dans la même base : on les fait tourner en série.
  fullyParallel: false,
  workers: 1,
  retries: CI ? 2 : 1,
  timeout: 30_000,
  forbidOnly: CI,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    // Le jeu se joue au téléphone : c'est la taille qui compte.
    ...devices['Pixel 7'],
  },

  projects: [
    // Se connecte une fois par rôle et sauvegarde les cookies.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: {
    // Build de prod : un seul process sert l'API et le client.
    command: 'npm start -w server',
    cwd: '..',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    // Le log HTTP du serveur noie le rapport ; les erreurs, elles, restent visibles.
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      PORT: String(E2E_PORT),
      CLIENT_URL: BASE_URL,
      JWT_SECRET: 'e2e-secret',
      SESSION_SECRET: 'e2e-secret',
      // Les outils de dev ne servent pas aux tests : on passe par les vrais écrans.
      DEV_TOOLS: '0',
    },
  },
})
