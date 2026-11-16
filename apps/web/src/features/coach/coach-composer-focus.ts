const NARROW_COACH = "(max-width: 767px)"

export function coachViewportIsNarrow() {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(NARROW_COACH).matches
    )
  } catch {
    return false
  }
}
