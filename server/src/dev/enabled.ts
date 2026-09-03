/**
 * Les outils de dev (seed, changement d'identité, combats bidon) contournent
 * l'authentification. Ils ne doivent JAMAIS tourner en production.
 *
 * Double verrou, volontairement fail-closed : il faut un opt-in explicite
 * (`DEV_TOOLS=1`) **et** ne pas être en prod. Une variable absente ou mal
 * orthographiée laisse les outils éteints.
 */
export function devToolsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEV_TOOLS === '1' && env.NODE_ENV !== 'production'
}
