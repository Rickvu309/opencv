export function readStored<T>(
  key: string,
  parse: (raw: string | null) => T,
  fallback: T
): T {
  try {
    return parse(window.localStorage.getItem(key))
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: the preference stays session-only.
  }
}
