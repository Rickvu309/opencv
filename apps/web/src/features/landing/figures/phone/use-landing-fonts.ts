import { useEffect, useReducer } from "react"

const LANDING_FACES = ["400 16px Inter", "500 16px Inter", "600 16px Inter"]

export function useLandingFonts() {
  const [loaded, fontsLoaded] = useReducer(
    (_: boolean, next: true) => next,
    undefined,
    () => !document.fonts
  )
  useEffect(() => {
    if (loaded) return
    let live = true
    Promise.all(LANDING_FACES.map((face) => document.fonts.load(face)))
      .catch(() => [])
      .then(() => live && fontsLoaded(true))
    return () => {
      live = false
    }
  }, [loaded])
  return loaded
}
