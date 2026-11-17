import { useReducer } from "react"

function keepLatest<T>(_: T | null, next: T | null): T | null {
  return next
}

export function useShownWhileClosing<T>(value: T | null): T | null {
  const [shown, keep] = useReducer(keepLatest<T>, value)
  if (value !== null && value !== shown) keep(value)
  return value ?? shown
}
