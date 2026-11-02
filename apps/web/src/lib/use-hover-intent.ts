import { useCallback, useEffect, useReducer, useRef } from "react"
import type { PointerEvent } from "react"

import { useShortcut } from "@/lib/use-shortcut.ts"

type Options = { openDelay?: number; closeDelay?: number }

export function useHoverIntent({
  openDelay = 150,
  closeDelay = 300,
}: Options = {}) {
  const [open, setOpen] = useReducer(
    (_open: boolean, next: boolean) => next,
    false
  )
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timer.current === null) return
    clearTimeout(timer.current)
    timer.current = null
  }, [])

  const scheduleClose = useCallback(() => {
    clear()
    timer.current = setTimeout(() => {
      timer.current = null
      setOpen(false)
    }, closeDelay)
  }, [clear, closeDelay])

  const close = useCallback(() => {
    clear()
    setOpen(false)
  }, [clear])

  useEffect(() => clear, [clear])

  useShortcut({
    key: "Escape",
    enabled: open,
    inFields: true,
    prevent: false,
    onPress: close,
  })

  function enterTrigger(event: PointerEvent) {
    if (event.pointerType !== "mouse") return
    clear()
    if (open) return
    timer.current = setTimeout(() => {
      setOpen(true)
      scheduleClose()
    }, openDelay)
  }

  function leave(event: PointerEvent) {
    if (event.pointerType !== "mouse") return
    if (open) scheduleClose()
    else clear()
  }

  function enterContent(event: PointerEvent) {
    if (event.pointerType === "mouse") clear()
  }

  return {
    open,
    close,
    triggerProps: { onPointerEnter: enterTrigger, onPointerLeave: leave },
    contentProps: { onPointerEnter: enterContent, onPointerLeave: leave },
  }
}
