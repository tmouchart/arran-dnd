import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
}

export const toasts = ref<Toast[]>([])

let nextId = 1

export function showToast(
  message: string,
  options?: { actionLabel?: string; onAction?: () => void; duration?: number },
): void {
  const id = nextId++
  toasts.value.push({ id, message, actionLabel: options?.actionLabel, onAction: options?.onAction })
  setTimeout(() => dismissToast(id), options?.duration ?? 6000)
}

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}
