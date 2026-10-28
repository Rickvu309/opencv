import { expect } from "vitest"

export type Snapshot = {
  source: { frameId: string; frameName: string }
  sections: { name: string; texts: string[] }[]
}
export type Styles = { sections: { marks: unknown[] }[] }

function normalize(value: string) {
  return value.replaceAll(/[‘']/g, "’").replaceAll(/\s+/g, " ").trim()
}

function hidden(element: Element) {
  return (
    element.getAttribute("aria-hidden") === "true" ||
    element.hasAttribute("hidden") ||
    element.classList.contains("sr-only")
  )
}

function shownText(root: Element) {
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "")
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as Element
    if (hidden(element)) return
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      parts.push(" ", element.value || element.placeholder, " ")
    }
    if (element instanceof HTMLElement && element.dataset.penText)
      parts.push(" ", element.dataset.penText, " ")
    for (const child of element.childNodes) walk(child)
    parts.push(" ")
  }
  walk(root)
  return normalize(parts.join(""))
}

function contains(haystack: string, needle: string) {
  const word = (char: string | undefined) =>
    char !== undefined && /[\p{L}\p{N}]/u.test(char)
  let from = 0
  for (;;) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) return false
    const before = haystack[index - 1]
    const after = haystack[index + needle.length]
    const leftOk = !word(needle[0]) || !word(before)
    const rightOk = !word(needle[needle.length - 1]) || !word(after)
    if (leftOk && rightOk) return true
    from = index + 1
  }
}

export function expectFrame(
  root: Element,
  snapshot: Snapshot,
  styles: Styles | null,
  notShown: Record<string, string> = {},
  iconsNotDrawn = 0
) {
  const text = shownText(root)
  const missing = snapshot.sections
    .flatMap((section) => section.texts)
    .map(normalize)
    .filter((want) => !(want in notShown) && !contains(text, want))
  expect(missing, `${snapshot.source.frameName} texts`).toEqual([])
  const stale = Object.keys(notShown).filter((want) => contains(text, want))
  expect(stale, `${snapshot.source.frameName} stale NOT_SHOWN`).toEqual([])
  if (!styles) return
  const marks = styles.sections.reduce(
    (sum, section) => sum + section.marks.length,
    0
  )
  const drawn = root.querySelectorAll("svg, img").length
  expect(drawn, `${snapshot.source.frameName} icons`).toBeGreaterThanOrEqual(
    marks - iconsNotDrawn
  )
}

export const main = () => {
  const element = document.getElementById("app-main")
  if (!element) throw new Error("#app-main is not rendered")
  return element
}
