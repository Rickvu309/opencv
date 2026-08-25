import { useEffect, useState } from "react"

export const DESKTOP_MEDIA_QUERY = "(min-width: 768px)"

export function readMediaQuery(query: string, defaultValue: boolean) {
  if (typeof window.matchMedia !== "function") {
    return defaultValue
  }
  return window.matchMedia(query).matches
}

export function useMediaQuery(query: string, defaultValue: boolean) {
  const [matches, setMatches] = useState(() =>
    readMediaQuery(query, defaultValue)
  )

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return
    }

    const media = window.matchMedia(query)
    setMatches(media.matches)

    const onChange = () => setMatches(media.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [query])

  return matches
}
