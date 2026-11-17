import { useState } from "react"

export function useShownWhileClosing<T>(value: T | null): T | null {
  const [shown, setShown] = useState(value)
  if (value !== null && value !== shown) setShown(value)
  return value ?? shown
}
