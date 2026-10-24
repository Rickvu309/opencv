import { useCallback, useEffect, useState, type RefObject } from "react"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"

type SectionFocus = { ids: string[]; nonce: number }

export function useSectionFocus(canvasRef: RefObject<HTMLDivElement | null>) {
  const [sectionFocus, setSectionFocus] = useState<SectionFocus>({
    ids: [],
    nonce: 0,
  })
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)", false)

  useEffect(() => {
    const root = canvasRef.current
    if (!root || sectionFocus.ids.length === 0) return
    const els = sectionFocus.ids
      .map((id) =>
        root.querySelector<HTMLElement>(
          `[data-paper-section="${CSS.escape(id)}"]`
        )
      )
      .filter((el): el is HTMLElement => Boolean(el))
    for (const el of els) el.classList.add("paper-coach-changed")
    const first = els[0]
    if (typeof first?.scrollIntoView === "function") {
      first.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      })
    }
    const timer = window.setTimeout(() => {
      for (const el of els) el.classList.remove("paper-coach-changed")
      setSectionFocus((prev) =>
        prev.nonce === sectionFocus.nonce
          ? { ids: [], nonce: prev.nonce }
          : prev
      )
    }, 1200)
    return () => {
      window.clearTimeout(timer)
      for (const el of els) el.classList.remove("paper-coach-changed")
    }
  }, [canvasRef, sectionFocus, reduceMotion])

  const focusSections = useCallback((ids: string[]) => {
    setSectionFocus((prev) => ({ ids, nonce: prev.nonce + 1 }))
  }, [])

  const clearSectionFocus = useCallback(() => {
    setSectionFocus({ ids: [], nonce: 0 })
  }, [])

  return { focusSections, clearSectionFocus }
}
