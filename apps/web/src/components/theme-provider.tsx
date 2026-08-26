import * as React from "react"

type ThemeProviderProps = {
  children: React.ReactNode
}

/**
 * Light-only shell (ADR-0008). The kit `.dark` token block stays dormant;
 * the undocumented `d` hotkey is gone.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark")
    root.classList.add("light")
  }, [])

  return children
}
