import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { AUTH_COPY } from "@/features/auth/auth-copy.ts"
import { setMockGoogle, setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import { authShaderFill } from "./auth-shader-fill.ts"
import snapshotFile from "./design/auth.snapshot.json"

const SCREEN_ONLY_COPY_NEVER_A_HIDDEN_PEN_LINE = [
  AUTH_COPY.googleUnavailable,
  AUTH_COPY.emailInvalid,
  AUTH_COPY.codeBad,
  AUTH_COPY.tooManyTries,
  AUTH_COPY.tooManyCodes,
  AUTH_COPY.sendFailed,
] as const

type PenFill = {
  type?: string
  url?: string
  uniforms?: Record<string, number>
}

type AuthSnapshot = {
  sections: { id: string; name: string; texts: string[]; fills?: PenFill[] }[]
}

const snapshot = snapshotFile as AuthSnapshot

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "META"])

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function normalize(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim()
}

function isWordChar(char: string): boolean {
  return char !== "" && /[\p{L}\p{N}]/u.test(char)
}

function bounded(haystack: string, needle: string, at: number): boolean {
  const before = at > 0 ? haystack[at - 1] : ""
  const after =
    at + needle.length < haystack.length ? haystack[at + needle.length] : ""
  const leftOk = !isWordChar(needle[0] ?? "") || !isWordChar(before)
  const rightOk =
    !isWordChar(needle[needle.length - 1] ?? "") || !isWordChar(after)
  return leftOk && rightOk
}

function hidden(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName)) return true
  if (element.getAttribute("aria-hidden") === "true") return true
  if (element.hasAttribute("hidden")) return true
  if (element.classList.contains("sr-only")) return true
  if (element.classList.contains("hidden")) return true
  if (element.classList.contains("invisible")) return true
  return false
}

function visibleText(root: Element): string {
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
      if (element.placeholder) parts.push(element.placeholder)
    }
    for (const child of element.childNodes) walk(child)
  }
  walk(root)
  return normalize(parts.join(" "))
}

function nextHit(
  haystack: string,
  needle: string,
  from: number,
  longer: readonly string[]
): number {
  let cursor = from
  while (cursor < haystack.length) {
    const at = haystack.indexOf(needle, cursor)
    if (at < 0) return -1
    cursor = at + 1
    if (!bounded(haystack, needle, at)) continue
    const end = at + needle.length
    const inside = longer.some((item) => {
      let coverFrom = 0
      while (coverFrom < haystack.length) {
        const coverAt = haystack.indexOf(item, coverFrom)
        if (coverAt < 0) return false
        coverFrom = coverAt + 1
        if (!bounded(haystack, item, coverAt)) continue
        if (coverAt <= at && end <= coverAt + item.length) return true
      }
      return false
    })
    if (!inside) return end
  }
  return -1
}

function missingInOrder(
  haystack: string,
  texts: readonly string[]
): string | null {
  const shownTexts = texts.map((text) => normalize(text))
  let cursor = 0
  for (let index = 0; index < shownTexts.length; index += 1) {
    const needle = shownTexts[index] ?? ""
    const longer = shownTexts.filter(
      (item, itemIndex) =>
        itemIndex !== index &&
        item.length > needle.length &&
        item.includes(needle)
    )
    const end = nextHit(haystack, needle, cursor, longer)
    if (end < 0) return texts[index] ?? needle
    cursor = end
  }
  return null
}

function stripNeedles(haystack: string, needles: readonly string[]): string {
  const ordered = [...needles]
    .map((needle) => normalize(needle))
    .filter((needle) => needle !== "")
    .sort((left, right) => right.length - left.length)
  let current = haystack
  for (const needle of ordered) {
    let built = ""
    let from = 0
    while (from < current.length) {
      const at = current.indexOf(needle, from)
      if (at < 0) {
        built += current.slice(from)
        break
      }
      if (!bounded(current, needle, at)) {
        built += current.slice(from, at + 1)
        from = at + 1
        continue
      }
      built += `${current.slice(from, at)} `
      from = at + needle.length
    }
    current = built
  }
  return normalize(current)
}

function readUniforms(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

function radioText(frame: Element, name: string): string {
  const radio = [...frame.querySelectorAll('[role="radio"]')].find((node) =>
    (node.textContent ?? "").includes(name)
  )
  return radio ? normalize(radio.textContent ?? "") : ""
}

function penReadingOrder(frame: Element, name: string): string {
  if (name === "Left") {
    const brand = frame.querySelector("[data-pen-region='brand']")
    const form = frame.querySelector("[data-pen-region='form']")
    const terms = frame.querySelector("[data-pen-region='terms']")
    return normalize(
      [
        brand ? visibleText(brand) : "",
        radioText(frame, "EN"),
        radioText(frame, "VI"),
        form ? visibleText(form) : "",
        terms ? visibleText(terms) : "",
      ].join(" ")
    )
  }
  const section = frame.querySelector(`[data-pen-section="${name}"]`)
  return section ? visibleText(section) : ""
}

describe("auth design parity", () => {
  it("matches the W1.1 pen frame, including the shader and hidden lines", async () => {
    setMockSession(null)
    setMockGoogle(true)
    const { container } = renderApp("/sign-in")
    const heading = await screen.findByRole("heading", {
      name: AUTH_COPY.logIn,
    })
    await screen.findByRole("button", { name: AUTH_COPY.google })

    const frame = container.querySelector("[data-pen-frame]") ?? container
    const problems: string[] = []

    if (!heading.querySelector("[data-slot='mark']")) {
      problems.push("heading is missing the brand mark next to Log in to")
    }

    for (const section of snapshot.sections) {
      const reading = penReadingOrder(frame, section.name)
      const missing = missingInOrder(reading, section.texts)
      if (missing) {
        problems.push(`${section.name}: missing ${JSON.stringify(missing)}`)
      }
      for (const fill of section.fills ?? []) {
        if (fill.type !== "shader" || typeof fill.url !== "string") continue
        const node = frame.querySelector(`[data-pen-fill="shader:${fill.url}"]`)
        if (!node) {
          problems.push(`missing shader fill shader:${fill.url}`)
          continue
        }
        const raw = node.getAttribute("data-pen-uniforms") ?? "{}"
        const used = readUniforms(raw)
        if (JSON.stringify(used) !== JSON.stringify(fill.uniforms ?? {})) {
          problems.push(
            `shader uniforms for ${fill.url} differ from the snapshot`
          )
        }
        if (
          JSON.stringify(authShaderFill.uniforms) !==
            JSON.stringify(fill.uniforms ?? {}) ||
          authShaderFill.url !== fill.url
        ) {
          problems.push(
            `shader uniforms for ${fill.url} differ from the snapshot`
          )
        }
      }
    }

    const needles = [
      ...snapshot.sections.flatMap((section) => section.texts),
      ...SCREEN_ONLY_COPY_NEVER_A_HIDDEN_PEN_LINE,
    ]
    const extra = stripNeedles(visibleText(frame), needles)
    if (extra) problems.push(`extra text ${JSON.stringify(extra)}`)

    expect(problems.join("\n")).toBe("")
  })
})
