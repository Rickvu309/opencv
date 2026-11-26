import { useSyncExternalStore } from "react"

let panelOpen = false
let panelChatId: string | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function setCoachPanelOpen(open: boolean) {
  if (panelOpen === open) return
  panelOpen = open
  emit()
}

export function setCoachPanelChat(chatId: string | null) {
  if (panelChatId === chatId) return
  panelChatId = chatId
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useCoachPanelChat() {
  return useSyncExternalStore(
    subscribe,
    () => (panelOpen ? panelChatId : null),
    () => null
  )
}
