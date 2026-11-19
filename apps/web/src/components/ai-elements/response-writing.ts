import { createContext } from "react"

export const ResponseWriting = createContext(false)

export function writtenWords(text: string) {
  return text.match(/\s*\S+\s*|\s+/g) ?? []
}
