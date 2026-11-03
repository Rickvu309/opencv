import { useEffect, useReducer, useRef } from "react"

export function useOnScreen<T extends Element>({
  once = false,
  threshold = 0,
}: { once?: boolean; threshold?: number } = {}) {
  const ref = useRef<T>(null)
  const [onScreen, visibilityChanged] = useReducer(
    (_: boolean, visible: boolean) => visible,
    false
  )

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === "undefined") {
      visibilityChanged(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visibilityChanged(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { threshold }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [once, threshold])

  return [ref, onScreen] as const
}
