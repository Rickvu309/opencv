import { useLayoutEffect, useRef } from "react"
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

let handoffWatch: { stop: () => void } | undefined

function keepClosedAfterHandoff(target: HTMLElement) {
  handoffWatch?.stop()
  const watcher = new MutationObserver(() => {
    if (target.hasAttribute("data-popup-open")) dismiss(target)
  })
  watcher.observe(target, {
    attributes: true,
    attributeFilter: ["data-popup-open"],
  })
  const timer = setTimeout(() => watcher.disconnect(), HANDOFF_WATCH_MS)
  handoffWatch = {
    stop: () => {
      clearTimeout(timer)
      watcher.disconnect()
    },
  }
}

export function FocusSafeRegion({
  as: Tag = "div",
  concealed,
  focusFallback,
  ...props
}: Props) {
  const region = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = region.current
    if (!element) return
    if (concealed) closeOpenPopups(element)
    if (concealed && element.contains(document.activeElement)) {
      const fallback = focusFallback()
      if (fallback) {
        keepClosedAfterHandoff(fallback)
        fallback.focus()
      }
    }
    element.toggleAttribute("inert", concealed)
  }, [concealed, focusFallback])

  return <Tag {...props} ref={region} />
}
