import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { blankCv, type PaperPages, type PaperView } from "@workspace/domain"

import { PaperCvEditor } from "./paper-cv-editor.tsx"
import { PaperLibrary } from "./paper-library.tsx"
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
  id: "11111111-1111-4111-8111-111111111111",
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

const pages: PaperPages = {
  docId: record.id,
  pages: 1,
  pageChoice: "unset",
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
  expect(content?.className).toContain("sm:max-w-3xl")
  expect(content?.className).not.toContain("sm:max-w-sm")
  expect(content.className).toContain("max-sm:h-dvh")
  expect(content.className).toContain("max-sm:top-0")
  expect(content.className).toContain("flex-col")
  const scroll = content.querySelector<HTMLElement>("[data-template-scroll]")
  expect(scroll?.className).toContain("overflow-y-auto")
  expect(scroll?.className).toContain("min-h-0")
  expect(scroll?.className).toContain("overscroll-contain")
  const actions = content.querySelector<HTMLElement>(
    "[data-slot=paper-gallery-actions]"
  )
  expect(actions?.className).toContain("shrink-0")
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
  for (const control of actions!.querySelectorAll("button"))
    expect(control.className, control.textContent ?? "").toMatch(/\bh-11\b/)
  expect(
    content.querySelector("input[aria-label='Search templates']")?.className
  ).toMatch(/\bh-11\b.*\btext-base\b/)
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
const search = () => screen.getByRole("searchbox", { name: "Search templates" })
const shownCards = () =>
  [...document.querySelectorAll<HTMLElement>("[data-template-card]")].map(
    (element) => element.dataset.templateCard
  )

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Paper template gallery", () => {
  it("leads with Blank and the four distinct pages, and keeps the other names behind search", () => {
    render(<Chooser onBlank={() => undefined} onImport={() => undefined} />)
    expect(shownCards()).toEqual(["blank", ...FEATURED_TEMPLATES])
    expect(card("Blank")).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("button", { name: "Start blank" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Import a file" })).toBeEnabled()
    expect(screen.queryByText(/more names/)).toBeNull()
    expect(PAPER_TEMPLATE_LABELS).toHaveLength(16)
    expect(TEMPLATE_CHOICES.map((choice) => choice.id)).toEqual([
      ...FEATURED_TEMPLATES,
    ])
  })

  it("starts each template from the API's lines and draws its name, headings and line blocks large enough to tell apart", () => {
    expect(templatePageLines("simple")).toEqual([
      { style: "Title", text: "[Your name]", center: true },
      { style: "Normal", text: "[Headline]", center: true },
      {
        style: "Normal",
        text: "[Email] | [Phone] | [City] | [LinkedIn]",
        center: true,
      },
      { style: "Heading1", text: "Summary" },
      {
        style: "Normal",
        text: "[Two or three lines on who you are and the work you want]",
      },
      { style: "Heading1", text: "Experience" },
      { style: "Normal", text: "[Role, company] | [Dates]" },
      {
        style: "ListBullet",
        text: "[What you did, and what changed because of it]",
      },
      { style: "Heading1", text: "Education" },
      { style: "Normal", text: "[School, degree] | [Dates]" },
      {
        style: "ListBullet",
        text: "[A course, result or project worth naming]",
      },
      { style: "Heading1", text: "Skills" },
      { style: "Normal", text: "[Tools, software and languages]" },
    ])
    render(<Chooser onBlank={() => undefined} />)
    const page = (id: string) =>
      [
        ...document.querySelectorAll(
          `[data-template-page="${id}"] :is([data-page-name],[data-page-heading])`
        ),
      ].map((line) => line.textContent)
    expect(page("simple")).toEqual([
      "Your name",
      "Summary",
      "Experience",
      "Education",
      "Skills",
    ])
    expect(page("modern")).toEqual([
      "Your name",
      "Profile",
      "Experience",
      "Selected work",
    ])
    expect(page("compact")).toEqual([
      "Your name",
      "Work experience",
      "About",
      "Education",
      "Skills",
    ])
    expect(page("academic")).toEqual([
      "Your name",
      "Education",
      "Projects & campus",
      "Experience",
      "Skills & languages",
    ])
    expect(
      document.querySelectorAll(
        '[data-template-page="simple"] [data-page-line]'
      )
    ).toHaveLength(8)
    const heading = document.querySelector<HTMLElement>("[data-page-heading]")
    expect(heading?.className).toMatch(/text-\[4\.6cqw\]/)
    expect(heading?.className).toContain("font-semibold")
    expect(
      document.querySelector('[data-template-page="blank"] [data-page-name]')
    ).toBeNull()
    expect(
      document.querySelector('[data-template-page="blank"] svg')
    ).toBeTruthy()
  })

  it("searches forgivingly, picks the top match, and says when nothing matches", () => {
    const onUse = vi.fn()
    const onBlank = vi.fn()
    render(<Chooser onUse={onUse} onBlank={onBlank} />)
    fireEvent.change(search(), { target: { value: "proj" } })
    expect(shownCards()).toEqual(["blank", "academic"])
    expect(card("Academic")).toHaveAttribute("aria-checked", "true")
    fireEvent.change(search(), { target: { value: "EDUC" } })
    expect(shownCards()).toEqual(["blank", "simple", "compact", "academic"])
    fireEvent.change(search(), { target: { value: "classic" } })
    expect(shownCards()).toEqual(["blank"])
    fireEvent.change(search(), { target: { value: "mod" } })
    expect(screen.getByText("1 template")).toHaveClass("sr-only")
    fireEvent.keyDown(search(), { key: "Enter" })
    expect(onUse).toHaveBeenCalledWith("modern")
    fireEvent.change(search(), { target: { value: "zzzz" } })
    expect(shownCards()).toEqual(["blank"])
    expect(screen.getByText(/No template matches/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Start blank" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "clear the search" }))
    expect(shownCards()).toEqual(["blank", ...FEATURED_TEMPLATES])
    fireEvent.change(search(), { target: { value: "blank" } })
    expect(shownCards()).toEqual(["blank"])
    fireEvent.keyDown(search(), { key: "Escape" })
    expect(search()).toHaveValue("")
    expect(chooserDialog()).toBeInTheDocument()
    expect(onBlank).not.toHaveBeenCalled()
  })

  it("moves through the grid with the arrow keys, Home and End, and Enter uses the focused choice", () => {
    const onUse = vi.fn()
    render(<Chooser onUse={onUse} onBlank={() => undefined} />)
    const grid = screen.getByRole("radiogroup", { name: "Templates" })
    card("Blank").focus()
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    expect(card("Simple")).toHaveFocus()
    expect(card("Simple")).toHaveAttribute("aria-checked", "true")
    expect(card("Simple")).toHaveAttribute("tabindex", "0")
    expect(card("Blank")).toHaveAttribute("tabindex", "-1")
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
    [
      "searching with results",
      () => fireEvent.change(search(), { target: { value: "c" } }),
    ],
    [
      "searching with none",
      () => fireEvent.change(search(), { target: { value: "zzzz" } }),
    ],
  ])(
    "keeps the sheet inside every window size, scrolls the grid inside it and pins the actions when %s",
    (_state, act_) => {
      render(<Chooser onBlank={() => undefined} onImport={() => undefined} />)
      act(act_)
      const primary = wideDialog()
      expect(primary).toBeEnabled()
    }
  )

  it("gives the dialog a wide frame that fits every window size and scrolls inside it, with its actions pinned in view", () => {
    const library = render(
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
    fireEvent.click(screen.getByRole("button", { name: "New" }))
    const kindDialog = document.querySelector("[data-slot='dialog-content']")
    expect(kindDialog?.className).toContain("sm:max-w-sm")
    expect(kindDialog?.className).not.toContain("sm:max-w-3xl")
    expect(screen.getByRole("dialog", { name: "New" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    expect(screen.getByRole("dialog", { name: "New CV" })).toBeInTheDocument()
    wideDialog()
    library.unmount()

    vi.stubGlobal(
      "fetch",
      () =>
        Promise.resolve(
          Response.json({ ok: true, data: {} })
        ) as Promise<Response>
    )
    render(
      <ChatStoreProvider>
        <PaperCvEditor
          initial={record}
          pages={pages}
          onBack={() => undefined}
        />
      </ChatStoreProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Change template" }))
    wideDialog()
  })
})
