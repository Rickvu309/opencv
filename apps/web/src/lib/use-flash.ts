import { useCallback, useEffect, useRef, useState } from "react"

export function useFlash(ms: number): [boolean, () => void] {
  const [active, setActive] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const trigger = useCallback(() => {
    window.clearTimeout(timer.current)
    setActive(true)
    timer.current = window.setTimeout(() => setActive(false), ms)
  }, [ms])

  return [active, trigger]
}
