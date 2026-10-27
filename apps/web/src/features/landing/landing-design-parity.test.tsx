import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import snapshotFile from "./design/landing.snapshot.json"

// Links to pages that do not exist yet, plus the subhead kept off the design
// line so verify-landing rule 03 passes. An entry whose text is on the page,
// whose replacedBy text is missing, or whose until date has passed fails.
const OMITTED = [
  {
    text: "Blog",
    reason: "Nav and footer link to a blog page that does not exist yet.",
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
    replacedBy:
      "Tailor your CV for every job and track every application. Prep with Coach.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    text: "Connect",
    reason:
      "Every link under this footer heading points to a page or account that does not exist yet.",
    until: "2026-11-30",
    approvedBy: "pending operator (quanvu309)",
  },
] as const satisfies readonly {
  text: string
  reason: string
  replacedBy?: string
  until: string
  approvedBy: string
}[]

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

// Each pen section is checked only inside the subtree that renders it.
const SECTION_SELECTOR: Record<string, string> = {
  Nav: "header.landing-nav",
  Hero: "#hero",
  Logos: "#logos",
  Statement: "#product",
  Benefits: "#benefits",
  "Paper Wrap": "#paper",
  "Apply Wrap": "#apply",
  "Coach Wrap": "#coach",
  "Integrations Wrap": "#integrations",
  "Coming next Wrap": "#coming-next",
  Customers: "#stories",
  Prefooter: "#close",
  "Footer Wrap": "footer",
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "META"])

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function calendarDay(now: Date): string {
  return now.toISOString().slice(0, 10)
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
function hitRanges(haystack: string, needle: string): Array<[number, number]> {
  if (needle === "") return []
  const ranges: Array<[number, number]> = []
  let from = 0
  while (from < haystack.length) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) break
    const before = at > 0 ? haystack[at - 1] : ""
    const after =
      at + needle.length < haystack.length ? haystack[at + needle.length] : ""
    const leftOk = !isWordChar(needle[0] ?? "") || !isWordChar(before)
    const rightOk =
      !isWordChar(needle[needle.length - 1] ?? "") || !isWordChar(after)
    if (leftOk && rightOk) ranges.push([at, at + needle.length])
    from = at + 1
  }
  return ranges
}

// Hits inside a longer snapshot string of the same section do not count.
function countBounded(
  haystack: string,
  needle: string,
  longer: readonly string[]
): number {
  const hits = hitRanges(haystack, needle)
  if (hits.length === 0) return 0
  const covers = longer.flatMap((item) => hitRanges(haystack, item))
  let count = 0
  for (const [start, end] of hits) {
    const inside = covers.some(
      ([coverStart, coverEnd]) => coverStart <= start && end <= coverEnd
    )
    if (!inside) count += 1
  }
  return count
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
    for (const child of element.childNodes) walk(child)
  }
  walk(root)
  return normalize(parts.join(" "))
}

function longerNeedles(texts: readonly string[], needle: string): string[] {
  return texts.filter(
    (item) => item.length > needle.length && item.includes(needle)
  )
}

function occurrences(
  root: Element,
  needle: string,
  texts: readonly string[]
): number {
  if (needle === "") return 0
  return countBounded(visibleText(root), needle, longerNeedles(texts, needle))
}

describe("landing design parity", () => {
  it("shows every pen-frame text, except dated omissions", async () => {
    setMockSession(null)
    const { container } = renderApp("/")
    await screen.findByRole("heading", { level: 1 })

    const page = container.querySelector(".landing-root")
    expect(page).not.toBeNull()
    const root = page as Element
    const today = calendarDay(new Date())
    const omitted = new Set<string>(OMITTED.map((entry) => entry.text))
    const problems: string[] = []
    const roots = new Map<string, Element | null>()
    for (const section of snapshot.sections) {
      const selector = SECTION_SELECTOR[section.name]
      roots.set(section.name, selector ? root.querySelector(selector) : null)
    }

    const listedIn = (needle: string) =>
      snapshot.sections.filter((section) =>
        section.texts.some((text) => normalize(text) === needle)
      )

    const seenIn = (sections: typeof snapshot.sections, text: string) =>
      sections.some((section) => {
        const sectionRoot = roots.get(section.name)
        if (!sectionRoot) return false
        const texts = section.texts.map((item) => normalize(item))
        return occurrences(sectionRoot, text, texts) >= 1
      })

    for (const entry of OMITTED) {
      if (today > entry.until) {
        problems.push(
          `OMITTED entry "${entry.text}" until ${entry.until} has passed.`
        )
      }
      const homes = listedIn(normalize(entry.text))
      if (
        "replacedBy" in entry &&
        !seenIn(homes, normalize(entry.replacedBy))
      ) {
        problems.push(
          `OMITTED entry "${entry.text}" names replacement "${entry.replacedBy}", which is not on the page. ${DRIFT}`
        )
      }
      if (seenIn(homes, normalize(entry.text))) {
        problems.push(
          `OMITTED entry "${entry.text}" is on the page. The exception is stale.`
        )
      }
    }

    for (const section of snapshot.sections) {
      const sectionRoot = roots.get(section.name) ?? null
      const texts = section.texts.map((item) => normalize(item))
      const need = new Map<string, { text: string; times: number }>()
      for (const text of section.texts) {
        if (omitted.has(text)) continue
        const needle = normalize(text)
        const row = need.get(needle)
        if (row) row.times += 1
        else need.set(needle, { text, times: 1 })
      }
      for (const [needle, row] of need) {
        const count = sectionRoot ? occurrences(sectionRoot, needle, texts) : 0
        if (count >= row.times) continue
        problems.push(
          `${section.name}: missing ${JSON.stringify(row.text)}. ${DRIFT}`
        )
      }
    }

    expect(problems.join("\n\n")).toBe("")
  })
})
