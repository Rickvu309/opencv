import { createContext } from "react"

export type PromptInputFrameName = "page" | "standard"

export const PromptInputFrame = createContext<PromptInputFrameName>("standard")
