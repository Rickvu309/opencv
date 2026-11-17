import { createContext } from "react"

export type PromptInputFrameName = "home" | "page" | "standard"

export const PromptInputFrame = createContext<PromptInputFrameName>("standard")
