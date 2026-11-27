import { parsePaperId } from "@workspace/domain/kernel"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import { blankCv, type PaperView } from "@workspace/domain/paper-doc"

import { PaperLibrary } from "./paper-library.tsx"
import { libraryRouter } from "./paper-library.fixtures.tsx"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"

import {
  PAPER_GALLERY_DIALOG_CLASS,
  PaperTemplateGallery,
} from "./paper-template-gallery.tsx"
import {
  FEATURED_TEMPLATES,
  TEMPLATE_CHOICES,
  templatePageLines,
} from "./paper-template-pages.ts"
import { PAPER_TEMPLATE_LABELS } from "./paper-templates.ts"
import { panelFit } from "@workspace/ui/lib/dialog-fit"

const record: PaperView = {
  id: parsePaperId("11111111-1111-4111-8111-111111111111"),
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  paper: blankCv(),
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  createdAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-25T12:00:00.000Z",
}

const GALLERY_WINDOWS = [
  { width: 390, height: 844 },
  { width: 390, height: 560 },
  { width: 600, height: 480 },
  { width: 820, height: 512 },
  { width: 1024, height: 700 },
  { width: 1440, height: 900 },
]

function chooserDialog() {
  const content = document
    .querySelector("[data-template-gallery]")
    ?.closest<HTMLElement>("[data-slot='dialog-content']")
  expect(content).toBeTruthy()
  return content!
}

function wideDialog() {
  const content = chooserDialog()
  for (const window of GALLERY_WINDOWS)
    expect(
      panelFit(content.className, window).problems,
      `${window.width}x${window.height}`
    ).toEqual([])
  const scroll = content.querySelector<HTMLElement>("[data-template-scroll]")
  const actions = content.querySelector<HTMLElement>(
    "[data-slot=paper-gallery-actions]"
  )
  expect(
    actions
      ?.querySelector("button")
      ?.closest("[data-slot=paper-gallery-actions]")
  ).toBe(actions)
  expect(scroll?.contains(actions!)).toBe(false)
  expect(actions?.compareDocumentPosition(scroll!)).toBe(
    Node.DOCUMENT_POSITION_PRECEDING
  )
  const primary = actions!.querySelector<HTMLElement>("[data-variant=primary]")
  expect(primary).toBeTruthy()
  expect(content.querySelector("[data-slot=dialog-close]")).toBeTruthy()
  return primary!
}

function Chooser(props: {
  onUse?: (id: string) => void
  onBlank?: () => void
  onImport?: () => void
  pending?: boolean
  initial?: "simple" | "modern" | "academic"
}) {
  return (
    <Dialog open>
      <DialogContent className={PAPER_GALLERY_DIALOG_CLASS}>
        <PaperTemplateGallery
          title="New CV"
          description="Pick a page, or bring a file you already have."
          onUse={props.onUse ?? (() => undefined)}
          onBlank={props.onBlank}
          onImport={props.onImport}
          pending={props.pending}
          initial={props.initial}
        />
      </DialogContent>
    </Dialog>
  )
}

const card = (name: string) => screen.getByRole("radio", { name })
const shownCards = () =>
  [...document.querySelectorAll<HTMLElement>("[data-template-card]")].map(
    (element) => element.dataset.templateCard
  )

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Paper template gallery", () => {
  it("leads with Blank and the four distinct pages, opens on the first template, with no search field to scan past", () => {
    render(<Chooser onBlank={() => undefined} onImport={() => undefined} />)
    expect(shownCards()).toEqual(["blank", ...FEATURED_TEMPLATES])
    expect(card("Blank")).toHaveAttribute("aria-checked", "false")
    expect(card("Simple")).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("button", { name: "Use Simple" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Import a file" })).toBeEnabled()
    expect(screen.queryByText(/more names/)).toBeNull()
    expect(screen.queryByRole("searchbox")).toBeNull()
    expect(PAPER_TEMPLATE_LABELS).toHaveLength(16)
    expect(TEMPLATE_CHOICES.map((choice) => choice.id)).toEqual([
      ...FEATURED_TEMPLATES,
    ])
  })

  it("previews each template as a filled example CV with no bracketed placeholders", () => {
    for (const id of FEATURED_TEMPLATES) {
      const lines = templatePageLines(id)
      expect(lines[0]).toEqual({
        style: "Title",
        text: "Linh Nguyen",
        center: true,
      })
      expect(
        lines.filter((line) => /[[\]]/.test(`${line.text}${line.aside ?? ""}`))
      ).toEqual([])
      expect(
        lines.filter((line) => line.style === "Entry" && !line.aside)
      ).toEqual([])
    }
    expect(
      templatePageLines("simple").filter((line) => line.style === "Entry")
    ).toContainEqual({
      style: "Entry",
      text: "Marketing Analyst Intern",
      aside: "May - August 2026",
    })
    render(<Chooser onBlank={() => undefined} />)
    const page = (id: string) =>
      [
        ...document.querySelectorAll(
          `[data-template-grid] [data-template-page="${id}"] :is([data-page-name],[data-page-heading])`
        ),
      ].map((line) => line.textContent)
    expect(page("simple")).toEqual([
      "Linh Nguyen",
      "Summary",
      "Experience",
      "Education",
      "Skills",
    ])
    expect(page("modern")).toEqual([
      "Linh Nguyen",
      "Profile",
      "Experience",
      "Selected work",
    ])
    expect(page("compact")).toEqual([
      "Linh Nguyen",
      "Work experience",
      "About",
      "Education",
      "Skills",
    ])
    expect(page("academic")).toEqual([
      "Linh Nguyen",
      "Education",
      "Projects & campus",
      "Experience",
      "Skills & languages",
    ])
    const lines = document.querySelectorAll(
      '[data-template-grid] [data-template-page="simple"] [data-page-line]'
    )
    expect([...lines].map((line) => line.textContent)).toEqual(
      templatePageLines("simple").map(
        (line) =>
          `${line.label ? `${line.label} ` : ""}${line.text}${line.aside ?? ""}`
      )
    )
    expect(
      document.querySelector('[data-template-page="blank"] [data-page-name]')
    ).toBeNull()
    expect(
      document.querySelector('[data-template-page="blank"]')
    ).toBeEmptyDOMElement()
  })

  it("moves through the grid with the arrow keys, Home and End, and Enter uses the focused choice", () => {
    const onUse = vi.fn()
    render(<Chooser onUse={onUse} onBlank={() => undefined} />)
    const grid = screen.getByRole("radiogroup", { name: "Templates" })
    card("Simple").focus()
    fireEvent.keyDown(grid, { key: "ArrowLeft" })
    expect(card("Blank")).toHaveFocus()
    expect(card("Blank")).toHaveAttribute("aria-checked", "true")
    expect(card("Blank")).toHaveAttribute("tabindex", "0")
    expect(card("Simple")).toHaveAttribute("tabindex", "-1")
    fireEvent.keyDown(grid, { key: "End" })
    expect(card("Academic")).toHaveFocus()
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    expect(card("Academic")).toHaveFocus()
    fireEvent.keyDown(grid, { key: "ArrowLeft" })
    expect(card("Compact")).toHaveFocus()
    expect(
      screen.getByRole("button", { name: "Use Compact" })
    ).toBeInTheDocument()
    fireEvent.keyDown(grid, { key: "Enter" })
    expect(onUse).toHaveBeenCalledWith("compact")
    fireEvent.keyDown(grid, { key: "Home" })
    expect(card("Blank")).toHaveFocus()
  })

  it("chooses with one click, uses with a double click, and locks every choice while a page is being made", () => {
    const onUse = vi.fn()
    const view = render(<Chooser onUse={onUse} onBlank={() => undefined} />)
    fireEvent.click(card("Modern"))
    expect(card("Modern")).toHaveAttribute("aria-checked", "true")
    expect(onUse).not.toHaveBeenCalled()
    fireEvent.doubleClick(card("Academic"))
    expect(onUse).toHaveBeenCalledWith("academic")
    view.rerender(<Chooser onUse={onUse} onBlank={() => undefined} pending />)
    const primary = wideDialog()
    expect(primary).toBeDisabled()
    expect(primary).toHaveTextContent("Creating…")
    expect(
      screen.getByRole("radiogroup", { name: "Templates" })
    ).toHaveAttribute("aria-busy", "true")
    fireEvent.click(card("Simple"))
    fireEvent.doubleClick(card("Simple"))
    expect(card("Simple")).toHaveAttribute("aria-checked", "false")
    expect(onUse).toHaveBeenCalledTimes(1)
  })

  it("opens on the current template when changing one, with no Blank or Import", () => {
    render(<Chooser initial="academic" />)
    expect(shownCards()).toEqual([...FEATURED_TEMPLATES])
    expect(card("Academic")).toHaveAttribute("aria-checked", "true")
    expect(screen.queryByRole("button", { name: "Import a file" })).toBeNull()
    expect(screen.getByRole("button", { name: "Use Academic" })).toBeEnabled()
  })

  it.each([
    ["opened", () => undefined],
    ["selected", () => fireEvent.click(card("Compact"))],
  ])(
    "keeps the sheet inside every window size, scrolls the grid inside it and pins the actions when %s",
    (_state, act_) => {
      render(<Chooser onBlank={() => undefined} onImport={() => undefined} />)
      act(act_)
      const primary = wideDialog()
      expect(primary).toBeEnabled()
    }
  )

  it("gives the chooser a frame that fits every window size and scrolls inside it, with its actions outside the scroll", () => {
    const library = render(
      libraryRouter(
        <PaperLibrary
          docs={[record]}
          files={[]}
          loading={false}
          error={null}
          onRetry={() => undefined}
          onOpen={() => undefined}
          query=""
          onQueryChange={() => undefined}
        />
      )
    )
    fireEvent.click(screen.getByRole("button", { name: "New" }))
    expect(screen.getByRole("dialog", { name: "New" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    expect(screen.getByRole("dialog", { name: "New CV" })).toBeInTheDocument()
    wideDialog()
    library.unmount()
  })
})
