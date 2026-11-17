import { createContext } from "react"

export type PromptInputFrameName = "page" | "panel" | "standard"

export const PromptInputFrame = createContext<PromptInputFrameName>("standard")
