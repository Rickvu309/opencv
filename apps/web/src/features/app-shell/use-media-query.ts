import { useEffect, useState } from "react"

export function useMediaQuery(query: string, defaultValue: boolean) {
  const [matches, setMatches] = useState(() => {
    if (typeof window.matchMedia !== "function") {
      return defaultValue
    }
    return window.matchMedia(query).matches
  })

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
