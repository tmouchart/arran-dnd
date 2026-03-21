import { ref } from 'vue'
import { fetchMe, login as apiLogin, logout as apiLogout, type AuthUser } from '../api/auth'

export const user = ref<AuthUser | null>(null)
export const authReady = ref(false)

export async function initAuth(): Promise<void> {
  user.value = await fetchMe()
  authReady.value = true
}

export async function login(username: string, password: string): Promise<void> {
  user.value = await apiLogin(username, password)
}

export async function logout(): Promise<void> {
  await apiLogout()
  user.value = null
}
