import { useSyncExternalStore } from "react"

let covering = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function setCoachPanelCovering(next: boolean) {
  if (covering === next) return
  covering = next
  emit()
}

export function useCoachPanelCovering() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => covering,
    () => covering
  )
}
