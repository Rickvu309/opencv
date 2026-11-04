import type { JobView, PaperView } from "@workspace/domain"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { paragraph, seededLetterClient } from "@/test/paper-fixture.ts"
import { job, letter } from "@/test/paper-letter-kit.tsx"
import { render } from "@/test/render-with-client.tsx"

import layout from "./design/letter-editor.layout.json"
import snapshot from "./design/letter-editor.snapshot.json"
import { PaperLetterEditor } from "./paper-letter.tsx"

const fixture = vi.hoisted(
  (): { client: ReturnType<typeof seededLetterClient> | null } => ({
    client: null,
  })
)

vi.mock("@/lib/paper-sync.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paper-sync.ts")>()),
  usePaperSync: () => ({
    sync: null,
    status: "saved" as const,
    generation: 1,
    client: fixture.client,
  }),
}))

const main = snapshot.sections.find((section) => section.name === "Main wrap")
if (!main) throw new Error("sgAtL snapshot has no Main wrap")
if (snapshot.source.frameId !== "sgAtL") {
  throw new Error(`letter editor snapshot is ${snapshot.source.frameId}`)
}
if (layout.frameId !== snapshot.source.frameId) {
  throw new Error("letter editor layout is a different frame")
}

const texts = main.texts
const coverAt = texts.indexOf("Cover letters")
const editedLabel = texts.find((text) => text.startsWith("Edited "))
const copyAt = texts.findIndex(
  (text) =>
    text.startsWith("The job asks for ") &&
    text.endsWith(". Add it if you've used it.")
)
if (coverAt < 1 || !editedLabel || copyAt < 2) {
  throw new Error("sgAtL Main wrap is missing the letter editor chrome")
}
const editedAt = texts.indexOf(editedLabel)
const documentTitle = texts[coverAt + 1]
const breadcrumbRoot = texts[coverAt - 1]
const suggestionTitle = texts[copyAt - 1]
const suggestion = texts[copyAt]
const addLabel = texts[copyAt + 1]
const skipLabel = texts[copyAt + 2]
const letterBody = texts.slice(editedAt + 1, copyAt - 1)
const keyword = suggestion.slice(
  "The job asks for ".length,
  suggestion.length - ". Add it if you've used it.".length
)
if (
  !documentTitle ||
  !breadcrumbRoot ||
  !suggestionTitle ||
  !addLabel ||
  !skipLabel ||
  letterBody.length === 0 ||
  keyword.length < 3 ||
  letterBody.some((line) => line.toLowerCase().includes(keyword.toLowerCase()))
) {
  throw new Error("sgAtL letter editor frame has no comparable letter")
}

const greeting = letterBody.find((line) => line.startsWith("Dear "))
if (!greeting) throw new Error("sgAtL letter has no greeting")

const frameJob: JobView = {
  ...job,
  posting: { requirements: keyword },
}

function frameDoc(): PaperView {
  return { ...letter, name: documentTitle, updatedAt: new Date().toISOString() }
}

function frameRow(text: string) {
  const row = layout.texts.find((entry) => entry.text === text)
  if (!row) throw new Error(`sgAtL layout has no ${text}`)
  return row
}

function weightClass(weight: number) {
  if (weight === 600) return "font-semibold"
  if (weight === 500) return "font-medium"
  if (weight === 400) return "font-normal"
  throw new Error(`sgAtL font weight ${weight} has no editor class`)
}

function expectFrameType(
  node: HTMLElement,
  text: string,
  parts: { size?: boolean; weight?: boolean; leading?: boolean }
) {
  const row = frameRow(text)
  const className = node.className
  if (parts.size) expect(className).toContain(`text-[${row.fontSize}px]`)
  if (parts.weight) expect(className).toContain(weightClass(row.fontWeight))
  if (parts.leading) {
    const leading =
      row.lineHeight === 16 ? "leading-4" : `leading-[${row.lineHeight}px]`
    expect(className).toContain(leading)
  }
}

function required(node: Element | null, name: string) {
  if (!(node instanceof HTMLElement)) throw new Error(`missing ${name}`)
  return node
}

function occurrences(haystack: string, needle: string) {
  if (needle.length === 0) return 0
  let count = 0
  let from = 0
  while (from < haystack.length) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return count
    count += 1
    from = at + needle.length
  }
  return count
}

function paragraphWith(root: ParentNode, text: string) {
  const node = [...root.querySelectorAll("p")].find(
    (item) => item.textContent?.trim() === text
  )
  if (!node) throw new Error(`missing paragraph ${text}`)
  return node
}

beforeAll(() => {
  installEditorPolyfills()
})

beforeEach(() => {
  fixture.client = seededLetterClient(
    letterBody.map((text, index) => paragraph(`line-${index + 1}`, text))
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderEditor(onBack = vi.fn()) {
  render(<PaperLetterEditor doc={frameDoc()} job={frameJob} onBack={onBack} />)
  return onBack
}

it("shows the pen letter, suggestion, and header, and Skip closes the card", async () => {
  const onBack = renderEditor()
  expect(await screen.findByText(greeting)).toBeInTheDocument()

  const header = required(
    document.querySelector('[data-slot="letter-editor-header"]'),
    "letter editor header"
  )
  const headerText = header.textContent ?? ""
  let cursor = 0
  for (const text of [
    breadcrumbRoot,
    "Cover letters",
    documentTitle,
    editedLabel,
  ]) {
    const at = headerText.indexOf(text, cursor)
    expect(at, text).toBeGreaterThanOrEqual(0)
    cursor = at + text.length
  }
  expectFrameType(header, breadcrumbRoot, { size: true })
  expectFrameType(
    screen.getByRole("button", { name: breadcrumbRoot }),
    breadcrumbRoot,
    { size: true, weight: true }
  )
  expectFrameType(
    required(
      document.querySelector('[data-slot="letter-editor-edited"]'),
      "edited label"
    ),
    editedLabel,
    { size: true, leading: true }
  )
  expect(
    required(
      document.querySelector('[data-slot="letter-editor-edited"]'),
      "edited label"
    ).textContent
  ).toBe(editedLabel)

  const card = required(
    document.querySelector('[data-slot="letter-editor-suggestion"]'),
    "suggestion"
  )
  const cardText = card.textContent ?? ""
  cursor = 0
  for (const text of [suggestionTitle, suggestion, addLabel, skipLabel]) {
    const at = cardText.indexOf(text, cursor)
    expect(at, text).toBeGreaterThanOrEqual(0)
    cursor = at + text.length
  }
  expectFrameType(paragraphWith(card, suggestionTitle), suggestionTitle, {
    size: true,
    weight: true,
    leading: true,
  })
  expectFrameType(paragraphWith(card, suggestion), suggestion, {
    size: true,
    leading: true,
  })
  expectFrameType(screen.getByRole("button", { name: addLabel }), addLabel, {
    size: true,
    weight: true,
  })
  expectFrameType(screen.getByRole("button", { name: skipLabel }), skipLabel, {
    size: true,
    weight: true,
  })
  expect(
    document.querySelector('[data-slot="letter-editor-connector"]')
  ).not.toBeNull()
  expect(
    document.querySelector('[data-slot="letter-editor-anchor"]')
  ).not.toBeNull()

  const sheet = required(
    document.querySelector('[data-slot="letter-editor-sheet"]'),
    "letter sheet"
  )
  expect(sheet.getAttribute("aria-label")).toBe(documentTitle)
  const sheetText = sheet.textContent ?? ""
  const bodyText = letterBody.join("\n")
  for (const line of letterBody) {
    expect(occurrences(sheetText, line), line).toBeGreaterThanOrEqual(
      occurrences(bodyText, line)
    )
  }

  fireEvent.click(screen.getByRole("button", { name: breadcrumbRoot }))
  expect(onBack).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: skipLabel }))
  expect(
    document.querySelector('[data-slot="letter-editor-suggestion"]')
  ).toBeNull()
  expect(
    document.querySelector('[data-slot="letter-editor-connector"]')
  ).toBeNull()
  expect(
    document.querySelector('[data-slot="letter-editor-anchor"]')
  ).toBeNull()
  expect(sheet.textContent ?? "").toContain(greeting)
})

it("inserts the frame's missing keyword into the letter", async () => {
  renderEditor()
  expect(await screen.findByText(greeting)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: addLabel }))
  expect(await screen.findByText(keyword)).toBeInTheDocument()
  expect(
    document.querySelector('[data-slot="letter-editor-sheet"]')?.textContent
  ).toContain(keyword)
})
