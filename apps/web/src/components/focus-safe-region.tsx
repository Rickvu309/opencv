import { useEffect, useLayoutEffect, useRef } from "react"
import type { ComponentProps } from "react"

type Props = ComponentProps<"div"> & {
  as?: "div" | "aside" | "nav" | "section"
  concealed: boolean
  focusFallback: () => HTMLElement | null
}

const HANDOFF_WATCH_MS = 300

function dismiss(trigger: Element) {
  trigger.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  )
}

function closeOpenPopups(region: HTMLElement) {
  for (const trigger of region.querySelectorAll("[data-popup-open]")) {
    dismiss(trigger)
  }
}

function keepClosedAfterHandoff(target: HTMLElement) {
  const watcher = new MutationObserver(() => {
    if (target.hasAttribute("data-popup-open")) dismiss(target)
  })
  watcher.observe(target, {
    attributes: true,
    attributeFilter: ["data-popup-open"],
  })
  const timer = setTimeout(() => watcher.disconnect(), HANDOFF_WATCH_MS)
  return () => {
    clearTimeout(timer)
    watcher.disconnect()
  }
}

export function FocusSafeRegion({
  as: Tag = "div",
  concealed,
  focusFallback,
  ...props
}: Props) {
  const region = useRef<HTMLDivElement>(null)
  const stopWatch = useRef<(() => void) | undefined>(undefined)

  useEffect(
    () => () => {
      stopWatch.current?.()
    },
    []
  )

  useLayoutEffect(() => {
    const element = region.current
    if (!element) return
    if (concealed) closeOpenPopups(element)
    if (concealed && element.contains(document.activeElement)) {
      const fallback = focusFallback()
      if (fallback) {
        stopWatch.current?.()
        stopWatch.current = keepClosedAfterHandoff(fallback)
        fallback.focus()
      }
    }
    element.toggleAttribute("inert", concealed)
  }, [concealed, focusFallback])

  return <Tag {...props} ref={region} />
}
