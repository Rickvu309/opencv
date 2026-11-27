export type KeyFacts = {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export type MoveUnit = "char" | "word" | "line" | "lineEdge" | "doc"

export type KeyAction =
  | { do: "move"; unit: MoveUnit; dir: -1 | 1; extend: boolean }
  | { do: "selectAll" }
  | { do: "undo" }
  | { do: "redo" }
  | { do: "mark"; mark: "bold" | "italic" | "underline" }
  | { do: "link" }
  | { do: "clearFormatting" }
  | { do: "kind"; kind: "paragraph" | "heading" | "subheading" }
  | { do: "list"; list: "bullet" | "numbered" }
  | { do: "level"; by: -1 | 1 }
  | { do: "enter" }
  | { do: "lineBreak" }
  | { do: "pageBreak" }
  | { do: "backspace"; word: boolean }
  | { do: "delete"; word: boolean }
  | { do: "tab"; by: -1 | 1 }

const MARKS = { b: "bold", i: "italic", u: "underline" } as const
const KINDS = {
  Digit0: "paragraph",
  Digit1: "heading",
  Digit2: "subheading",
} as const
const ARROWS: Record<string, -1 | 1> = { ArrowLeft: -1, ArrowRight: 1 }
const VERTICAL: Record<string, -1 | 1> = { ArrowUp: -1, ArrowDown: 1 }

function modified(facts: KeyFacts, mod: boolean): KeyAction | null {
  const key = facts.key.toLowerCase()
  if (facts.altKey && facts.code in KINDS)
    return { do: "kind", kind: KINDS[facts.code as keyof typeof KINDS] }
  if (facts.altKey) return null
  if (facts.shiftKey && facts.code === "Digit7")
    return { do: "list", list: "numbered" }
  if (facts.shiftKey && facts.code === "Digit8")
    return { do: "list", list: "bullet" }
  if (key === "z") return facts.shiftKey ? { do: "redo" } : { do: "undo" }
  if (key === "y" && !facts.shiftKey) return { do: "redo" }
  if (key === "a" && !facts.shiftKey) return { do: "selectAll" }
  if (key in MARKS && !facts.shiftKey)
    return { do: "mark", mark: MARKS[key as keyof typeof MARKS] }
  if (key === "k" && !facts.shiftKey) return { do: "link" }
  if (facts.code === "Backslash") return { do: "clearFormatting" }
  if (facts.code === "BracketRight") return { do: "level", by: 1 }
  if (facts.code === "BracketLeft") return { do: "level", by: -1 }
  if (facts.key === "Enter") return { do: "pageBreak" }
  if (facts.key === "Home")
    return { do: "move", unit: "doc", dir: -1, extend: facts.shiftKey }
  if (facts.key === "End")
    return { do: "move", unit: "doc", dir: 1, extend: facts.shiftKey }
  if (facts.key in ARROWS && mod)
    return {
      do: "move",
      unit: "word",
      dir: ARROWS[facts.key]!,
      extend: facts.shiftKey,
    }
  if (facts.key === "Backspace") return { do: "backspace", word: true }
  if (facts.key === "Delete") return { do: "delete", word: true }
  return null
}

export function keyAction(facts: KeyFacts): KeyAction | null {
  const mod = facts.ctrlKey || facts.metaKey
  if (mod) return modified(facts, mod)
  const extend = facts.shiftKey
  if (facts.altKey && facts.key in ARROWS)
    return { do: "move", unit: "word", dir: ARROWS[facts.key]!, extend }
  if (facts.altKey && facts.key === "Backspace")
    return { do: "backspace", word: true }
  if (facts.altKey) return null
  if (facts.key in ARROWS)
    return { do: "move", unit: "char", dir: ARROWS[facts.key]!, extend }
  if (facts.key in VERTICAL)
    return { do: "move", unit: "line", dir: VERTICAL[facts.key]!, extend }
  if (facts.key === "Home")
    return { do: "move", unit: "lineEdge", dir: -1, extend }
  if (facts.key === "End")
    return { do: "move", unit: "lineEdge", dir: 1, extend }
  if (facts.key === "Enter")
    return facts.shiftKey ? { do: "lineBreak" } : { do: "enter" }
  if (facts.key === "Backspace") return { do: "backspace", word: false }
  if (facts.key === "Delete") return { do: "delete", word: false }
  if (facts.key === "Tab") return { do: "tab", by: facts.shiftKey ? -1 : 1 }
  return null
}
