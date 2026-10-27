import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import snapshotFile from "./design/landing.snapshot.json"

// Links to pages that do not exist yet, plus the subhead kept off the design
// line so verify-landing rule 03 passes. An entry whose text is on the page,
// or whose until date has passed, fails this test.
const OMITTED = [
  {
    text: "Blog",
    reason: "Nav and footer link to a blog page that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "Help",
    reason: "Nav link to a help page that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "About",
    reason: "Footer link to an about page that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "Careers",
    reason: "Footer link to a careers page that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "Contact us",
    reason: "Footer link to a contact page that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "X",
    reason: "Footer link to an X profile that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "LinkedIn",
    reason: "Footer link to a LinkedIn profile that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "Privacy    Terms",
    reason:
      "Footer legal line linking to privacy and terms pages that do not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "Read all stories",
    reason: "Link to a stories index that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "Tailor your CV for every job. Track every application. Prep with Coach.",
    reason:
      "Replaced by a two-sentence version so verify-landing rule 03 passes.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
] as const

const DRIFT =
  "Landing text differs from opencv.pen frame w7zeGR (see apps/web/src/features/landing/design/landing.snapshot.json). Change the page to match, or add a dated OMITTED entry with a reason."

type LandingSnapshot = {
  source: {
    file: string
    branch: string
    frameId: string
    frameName: string
  }
  sections: { id: string; name: string; texts: string[] }[]
}

const snapshot = snapshotFile as LandingSnapshot

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "META"])

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function calendarDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

// The pen uses ’ (U+2019). Collapse whitespace, then use that apostrophe.
function normalize(value: string): string {
  return value
    .replaceAll("\u2018", "\u2019")
    .replaceAll("'", "\u2019")
    .replaceAll(/\s+/g, " ")
    .trim()
}

function isWordChar(char: string): boolean {
  return char !== "" && /[\p{L}\p{N}]/u.test(char)
}

// A snapshot string must show up as its own text. The X in "UX" is not the
// footer link "X".
function appears(haystack: string, needle: string): boolean {
  if (needle === "") return false
  let from = 0
  while (from < haystack.length) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return false
    const before = at > 0 ? haystack[at - 1] : ""
    const after =
      at + needle.length < haystack.length ? haystack[at + needle.length] : ""
    const leftOk = !isWordChar(needle[0] ?? "") || !isWordChar(before)
    const rightOk =
      !isWordChar(needle[needle.length - 1] ?? "") || !isWordChar(after)
    if (leftOk && rightOk) return true
    from = at + 1
  }
  return false
}

function hidden(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName)) return true
  if (element.getAttribute("aria-hidden") === "true") return true
  if (element.hasAttribute("hidden")) return true
  if (element.classList.contains("sr-only")) return true
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
    for (const child of element.childNodes) walk(child)
  }
  walk(root)
  return normalize(parts.join(" "))
}

describe("landing design parity", () => {
  it("shows every pen-frame text, except dated omissions", async () => {
    setMockSession(null)
    const { container } = renderApp("/")
    await screen.findByRole("heading", { level: 1 })

    const root = container.querySelector(".landing-root")
    expect(root).not.toBeNull()
    const page = visibleText(root as Element)
    const today = calendarDay(new Date())
    const omitted = new Set<string>(OMITTED.map((entry) => entry.text))
    const problems: string[] = []

    for (const entry of OMITTED) {
      if (today > entry.until) {
        problems.push(
          `OMITTED entry "${entry.text}" until ${entry.until} has passed.`
        )
      }
      if (appears(page, normalize(entry.text))) {
        problems.push(
          `OMITTED entry "${entry.text}" is on the page. The exception is stale.`
        )
      }
    }

    for (const section of snapshot.sections) {
      for (const text of section.texts) {
        if (omitted.has(text)) continue
        if (appears(page, normalize(text))) continue
        problems.push(
          `${section.name}: missing ${JSON.stringify(text)}. ${DRIFT}`
        )
      }
    }

    expect(problems.join("\n\n")).toBe("")
  })
})
