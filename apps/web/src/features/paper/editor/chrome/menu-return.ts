import { useRef } from "react"

function openedFromKeyboard(event: Event | undefined) {
  if (!event) return false
  if (event instanceof KeyboardEvent) return true
  return event.type === "click" && (event as MouseEvent).detail === 0
}

export function useMenuReturn(back: () => false) {
  const toTrigger = useRef(false)
  const keyboard = useRef(false)
  return {
    onOpenChange: (
      open: boolean,
      details: { reason: string; event?: Event }
    ) => {
      if (open) {
        keyboard.current = openedFromKeyboard(details.event)
        toTrigger.current = false
        return
      }
      toTrigger.current = details.reason === "escape-key" && keyboard.current
      if (!toTrigger.current) back()
    },
    finalFocus: () => toTrigger.current,
  }
}
