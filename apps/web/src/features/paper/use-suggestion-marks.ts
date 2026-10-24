import { useEffect, type RefObject } from "react"

export const SUGGESTED_CLASS = "paper-coach-suggested"

/** Keeps the sections a Coach write changed marked until the person keeps or undoes it. */
export function useSuggestionMarks(
  canvasRef: RefObject<HTMLDivElement | null>,
  sectionIds: readonly string[] | undefined
) {
  const key = sectionIds?.join("|") ?? ""
  useEffect(() => {
    const root = canvasRef.current
    if (!root || !key) return
    const els = key
      .split("|")
      .map((id) =>
        root.querySelector<HTMLElement>(
          `[data-paper-section="${CSS.escape(id)}"]`
        )
      )
      .filter((el): el is HTMLElement => Boolean(el))
    for (const el of els) el.classList.add(SUGGESTED_CLASS)
    return () => {
      for (const el of els) el.classList.remove(SUGGESTED_CLASS)
    }
  }, [canvasRef, key])
}
