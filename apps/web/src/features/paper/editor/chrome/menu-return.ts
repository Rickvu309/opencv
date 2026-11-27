import { useRef } from "react"

function openedFromKeyboard(event: Event | undefined) {
  if (!event) return false
  if (event instanceof KeyboardEvent) return true
  if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent)
    return event.pointerType === "" && event.detail === 0
  return event instanceof MouseEvent && event.detail === 0
}

export function useMenuReturn(back: () => false) {
  const closedBy = useRef("")
  const keyboard = useRef(false)
  return {
    onOpenChange: (
      open: boolean,
      details: { reason: string; event?: Event }
    ) => {
      if (open) keyboard.current = openedFromKeyboard(details.event)
      closedBy.current = open ? "" : details.reason
    },
    finalFocus: () =>
      closedBy.current === "escape-key" && keyboard.current ? true : back(),
  }
}
