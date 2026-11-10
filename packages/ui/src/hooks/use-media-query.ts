import { useCallback, useSyncExternalStore } from "react"

export function readMediaQuery(query: string, defaultValue: boolean) {
  if (typeof window.matchMedia !== "function") {
    return defaultValue
  }
  return window.matchMedia(query).matches
}

export function useMediaQuery(query: string, defaultValue: boolean) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window.matchMedia !== "function") {
        return () => {}
      }
      const media = window.matchMedia(query)
      media.addEventListener("change", onStoreChange)
      return () => media.removeEventListener("change", onStoreChange)
    },
    [query]
  )

  return useSyncExternalStore(
    subscribe,
    () => readMediaQuery(query, defaultValue),
    () => defaultValue
  )
}
