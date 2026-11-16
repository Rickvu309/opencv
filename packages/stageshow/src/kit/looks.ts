import { createContext, useContext } from "react"

export type Theme = "light" | "dark" | "blueprint" | "glass"
export type Palette = "accent" | "mono"
export type Fidelity = "minimal" | "standard" | "realistic"
export type Layout = "wide" | "compact"

export type Look = {
  theme: Theme
  palette: Palette
  fidelity: Fidelity
  layout: Layout
}

export const LookContext = createContext<Look>({
  theme: "light",
  palette: "accent",
  fidelity: "standard",
  layout: "wide",
})
export const useLook = () => useContext(LookContext)
