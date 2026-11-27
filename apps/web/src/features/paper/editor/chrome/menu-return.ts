import { useRef } from "react"

export function useMenuReturn(back: () => false) {
  const reason = useRef("")
  return {
    onOpenChange: (open: boolean, details: { reason: string }) => {
      reason.current = open ? "" : details.reason
    },
    finalFocus: () => (reason.current === "escape-key" ? true : back()),
  }
}
