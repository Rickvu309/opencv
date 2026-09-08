import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import {
  COACH_FLOAT_DESKTOP_OPEN_HEIGHT_CLASS,
  COACH_FLOAT_NUDGE_ATTR,
} from "@/features/paper/coach-float.tsx"
import { isCvDocument } from "@workspace/domain"

import { PAPER_CANVAS_FIELD_CLASS } from "@/features/paper/paper-cv-document.tsx"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  DEFAULT_COACH_STREAM_REPLY,
  getLastCoachRequest,
  getMockThreads,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

function renderPaper() {
  return renderApp(SURFACE_PATHS.paper)
}

async function openDoc(name: string) {
  fireEvent.click(await screen.findByText(name))
  const editor = await screen.findByRole("region", { name: `Editing ${name}` })
  expect(editor).toBeInTheDocument()
  return editor
}

function coachDialog() {
  return screen.getByRole("dialog", { name: "Coach" })
}

async function openCoach() {
  fireEvent.click(screen.getByRole("button", { name: "Coach" }))
  return screen.findByRole("dialog", { name: "Coach" })
}

function messageCoach(container: HTMLElement = coachDialog()) {
  return within(container).getByRole("textbox", { name: "Message Coach" })
}

function selectNodeContents(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  document.dispatchEvent(new Event("selectionchange"))
}

function collapseWindowSelection() {
  window.getSelection()?.removeAllRanges()
  document.dispatchEvent(new Event("selectionchange"))
}

function stubDesktopViewport(isDesktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === DESKTOP_MEDIA_QUERY ? isDesktop : true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe("Paper drive", () => {
  it("lists documents with status and filters by search", async () => {
    renderPaper()
    await expectPaperDrive()

    expect(screen.getByText("CVs")).toBeInTheDocument()
    expect(screen.getByText("Letters")).toBeInTheDocument()
    expect(screen.getAllByText("Proof").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0)
    expect(screen.getByText("Ready")).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()

    const search = screen.getByRole("textbox", { name: "Search documents" })
    fireEvent.change(search, { target: { value: "cover" } })

    expect(screen.getByText("Cover: Associate PM intern")).toBeInTheDocument()
    expect(screen.getByText("Cover: Product intern")).toBeInTheDocument()
    expect(screen.queryByText("PM track CV")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Checkout card resize study")
    ).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: "zzzz-no-doc" } })
    expect(
      screen.queryByText("Cover: Associate PM intern")
    ).not.toBeInTheDocument()
  })

  it("shows and changes the Apply card link", async () => {
    renderPaper()
    await expectPaperDrive()

    expect(screen.getByText("Local startup")).toBeInTheDocument()
    expect(screen.getByText("Fintech scale-up")).toBeInTheDocument()
    expect(screen.getByText("Linked to Apply")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Document actions for Cover: Associate PM intern",
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Change Apply link" }))
    const dialog = await screen.findByRole("dialog", { name: "Link to Apply" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Unlink" }))

    await waitFor(() => {
      expect(screen.queryByText("Local startup")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Fintech scale-up")).toBeInTheDocument()
  })

  it("marks filter as coming soon and keeps New enabled", async () => {
    renderPaper()
    await expectPaperDrive()

    const filter = screen.getByRole("button", { name: /filter/i })
    expect(filter).toBeDisabled()
    expect(filter).toHaveTextContent("Coming soon")
    expect(screen.getByRole("button", { name: "New document" })).toBeEnabled()
  })

  it("creates, renames, changes status, and deletes a document", async () => {
    renderPaper()
    await expectPaperDrive()

    fireEvent.click(screen.getByRole("button", { name: "New document" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Letter" }))

    expect(
      await screen.findByRole("region", { name: "Editing Untitled Letter" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /all documents/i }))
    await expectPaperDrive()
    expect(screen.getByText("Untitled Letter")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Document actions for Untitled Letter",
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }))
    const nameInput = await screen.findByRole("textbox", {
      name: "Document name",
    })
    fireEvent.change(nameInput, { target: { value: "Cover: intern" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Cover: intern")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Document actions for Cover: intern" })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Mark as Ready" })
    )
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Document actions for Cover: intern" })
          .closest("tr")
      ).toHaveTextContent("Ready")
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Document actions for Cover: intern" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const confirm = await screen.findByRole("dialog", { name: "Delete document" })
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog", { name: "Delete document" })).not.toBeInTheDocument()
    expect(screen.getByText("Cover: intern")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Document actions for Cover: intern" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const confirmAgain = await screen.findByRole("dialog", {
      name: "Delete document",
    })
    fireEvent.click(within(confirmAgain).getByRole("button", { name: "Delete" }))
    await waitFor(() => {
      expect(screen.queryByText("Cover: intern")).not.toBeInTheDocument()
    })
    await expectPaperDrive()
  })

  it("rolls content edits back and shows the real error message", async () => {
    const { failNextPaperCommand } = await import("@/test/paper-api-mock.ts")
    const { PAPER_COMMANDS } = await import("@workspace/domain")
    failNextPaperCommand(
      PAPER_COMMANDS.updateContent,
      "Headline must be a string"
    )

    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    const summary = screen.getByRole("textbox", { name: "Summary" })
    summary.textContent = "Edited summary that should roll back"
    fireEvent.input(summary)

    expect(
      await screen.findByRole("alert", {}, { timeout: 2000 })
    ).toHaveTextContent("Headline must be a string")
    await waitFor(() => {
      expect(summary).not.toHaveTextContent(
        "Edited summary that should roll back"
      )
    })
  })

  it("opens a document and returns to the drive", async () => {
    renderPaper()
    await expectPaperDrive()

    await openDoc("PM track CV")
    expect(
      screen.getByRole("button", { name: /all documents/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Paper" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /all documents/i }))
    await expectPaperDrive()
  })
})

describe("Paper editors", () => {
  it("opens a CV on A4 and switches among the five templates", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(screen.getAllByText(SAMPLE_AUTHOR_NAME).length).toBeGreaterThan(0)
    expect(screen.getByRole("textbox", { name: "Summary" })).toBeInTheDocument()

    const cvTools = screen.getByRole("toolbar", { name: "CV tools" })
    expect(within(cvTools).getByRole("button", { name: "Insert" })).toBeInTheDocument()
    expect(within(cvTools).getByRole("button", { name: "Export" })).toBeInTheDocument()
    expect(within(cvTools).queryByRole("button", { name: "Bold" })).not.toBeInTheDocument()
    expect(within(cvTools).queryByRole("button", { name: "Italic" })).not.toBeInTheDocument()
    expect(
      within(cvTools).queryByRole("button", { name: "Bullet list" })
    ).not.toBeInTheDocument()
    expect(document.querySelector("[data-cv-type='page-title']")).not.toBeNull()
    expect(document.querySelector("[data-cv-type='body']")).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /Product & design/ }))
    const templates = await screen.findByRole("listbox", {
      name: "CV templates",
    })
    expect(
      within(templates).getByRole("option", { name: /Classic internship/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Product & design/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Project-led/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Campus & projects/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /With photo/ })
    ).toBeInTheDocument()

    fireEvent.click(
      within(templates).getByRole("option", { name: /Classic internship/ })
    )
    expect(await screen.findByText("Summary")).toBeInTheDocument()
    expect(screen.queryByText("Profile")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Classic internship/ }))
    fireEvent.click(
      within(
        await screen.findByRole("listbox", { name: "CV templates" })
      ).getByRole("option", { name: /With photo/ })
    )
    expect(
      await screen.findByRole("button", { name: /profile photo/i })
    ).toBeInTheDocument()
  })

  it("shows quiet canvas focus chrome on Summary and Experience bullets", async () => {
    stubDesktopViewport(true)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    expect(bullet).toBeTruthy()

    for (const field of [summary, bullet!]) {
      expect(field).toHaveClass(PAPER_CANVAS_FIELD_CLASS)
      expect(field).toHaveAttribute("data-paper-canvas-field")
      expect(field.className).not.toMatch(/bg-muted\/80/)
      expect(field.className).not.toMatch(/border-input/)
      expect(field.className).not.toMatch(/rounded-full/)

      fireEvent.click(field)
      field.focus()
      expect(field).toHaveFocus()

      fireEvent.keyDown(field, { key: "Escape" })
      expect(field).not.toHaveFocus()

      field.focus()
      expect(field).toHaveFocus()
      field.blur()
      expect(field).not.toHaveFocus()
    }

    expect(editor.querySelector("[data-coach-soft-scope]")).toBeNull()
    expect(editor.querySelector("[data-coach-context-chip]")).toBeNull()
    expect(editor.querySelector("[data-coach-selection-preview]")).toBeNull()
  })

  it("keeps canvas field selection chrome distinct from CoachFloat chips", async () => {
    stubDesktopViewport(true)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]!

    expect(bullet).toHaveClass(PAPER_CANVAS_FIELD_CLASS)
    expect(bullet.className).not.toMatch(/bg-muted\/70/)
    expect(bullet.className).not.toMatch(/rounded-full/)

    selectNodeContents(bullet)
    messageCoach(dialog).focus()

    const preview = await within(dialog).findByRole("status", {
      name: "Selected text",
    })
    expect(preview).toHaveAttribute("data-coach-selection-preview")
    expect(preview.className).toMatch(/rounded-lg/)
    expect(preview.className).toMatch(/bg-muted\/70/)

    const softScope = within(dialog).getByRole("status", { name: "In context" })
    expect(softScope.querySelector(".rounded-full")).not.toBeNull()
    expect(softScope.className + (softScope.firstElementChild?.className ?? "")).toMatch(
      /bg-muted\/70/
    )
  })

  it("mutates Experience and Skills on the Sample CV and persists after refresh", async () => {
    stubDesktopViewport(true)
    const first = renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    const bulletsBefore = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })
    fireEvent.click(
      within(editor).getAllByRole("button", { name: "Add bullet" })[0]!
    )
    expect(
      within(editor).getAllByRole("textbox", { name: "Bullet point" })
    ).toHaveLength(bulletsBefore.length + 1)

    const skill = within(editor).getAllByRole("textbox", { name: "Skill" })[0]!
    skill.textContent = "Café interviews"
    fireEvent.input(skill)
    expect(skill).toHaveTextContent("Café interviews")

    await waitFor(
      () => {
        const cv = getMockPaperDocs().find((doc) => doc.name === "PM track CV")
        expect(cv && isCvDocument(cv.content)).toBe(true)
        if (!cv || !isCvDocument(cv.content)) return
        expect(cv.content.experience[0]?.bullets).toHaveLength(3)
        expect(cv.content.skills[0]?.items[0]).toBe("Café interviews")
      },
      { timeout: 2000 }
    )
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument()

    first.unmount()
    renderPaper()
    await expectPaperDrive()
    const again = await openDoc("PM track CV")
    expect(
      within(again).getAllByRole("textbox", { name: "Bullet point" })
    ).toHaveLength(bulletsBefore.length + 1)
    expect(within(again).getByText("Café interviews")).toBeInTheDocument()
    expect(again.querySelector("[data-coach-soft-scope]")).toBeNull()
  })

  it("tabs between CV fields and Esc blurs on desktop without trapping", async () => {
    stubDesktopViewport(true)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    const name = within(editor).getByRole("textbox", { name: "Full name" })
    const headline = within(editor).getByRole("textbox", { name: "Headline" })
    name.focus()
    fireEvent.keyDown(name, { key: "Tab" })
    expect(headline).toHaveFocus()

    fireEvent.keyDown(headline, { key: "Tab", shiftKey: true })
    expect(name).toHaveFocus()

    fireEvent.keyDown(name, { key: "Escape" })
    expect(name).not.toHaveFocus()
    expect(editor.contains(document.activeElement)).toBe(false)

    const dialog = await openCoach()
    expect(dialog).not.toHaveAttribute("draggable")
    expect(dialog.querySelector("[data-coach-float-resize]")).toBeNull()
  })

  it("fits A4 to a phone width with slim chrome and a usable edit", async () => {
    stubDesktopViewport(false)
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()

    const fit = editor.querySelector("[data-paper-a4-fit='width']")
    expect(fit).toBeInstanceOf(HTMLElement)
    const page = editor.querySelector(".cv-a4-page")
    expect(page).toBeInstanceOf(HTMLElement)
    expect((page as HTMLElement).style.maxWidth).toBe("100%")
    expect((page as HTMLElement).style.width).toBe("210mm")

    const canvas = editor.querySelector("[data-paper-canvas]")
    expect(canvas).toHaveClass("paper-editor-canvas-scroll")
    expect(editor.querySelector("[data-paper-editor]")).not.toBeNull()

    const toolbar = within(editor).getByRole("toolbar", { name: "CV tools" })
    expect(toolbar.className).toMatch(/sticky/)
    expect(toolbar).toHaveAttribute("data-paper-toolbar")

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    expect(summary).toHaveClass(PAPER_CANVAS_FIELD_CLASS)
    summary.textContent = "Café rewrite on a phone"
    fireEvent.input(summary)
    expect(summary).toHaveTextContent("Café rewrite on a phone")

    fireEvent.keyDown(summary, { key: "Escape" })
    expect(summary).not.toHaveFocus()

    const name = within(editor).getByRole("textbox", { name: "Full name" })
    const headline = within(editor).getByRole("textbox", { name: "Headline" })
    name.focus()
    fireEvent.keyDown(name, { key: "Tab" })
    expect(headline).toHaveFocus()

    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(
      document.querySelector("[data-coach-float-resize]")
    ).toBeNull()
  })

  it("opens and edits a Letter", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("Cover: Associate PM intern")

    const editor = screen.getByRole("textbox", { name: "Document content" })
    expect(editor).toHaveAttribute("contenteditable", "true")
    expect(editor).toHaveTextContent(/associate product manager intern/i)
    expect(editor).toHaveTextContent(new RegExp(`Best,\\s*Alex`))
    expect(editor).not.toHaveTextContent(/Eric/)

    editor.textContent = "Edited letter draft"
    fireEvent.input(editor)
    expect(editor).toHaveTextContent("Edited letter draft")
  })

  it("opens and edits a Proof, including the timeline view", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("Checkout card resize study")

    const title = screen.getByRole("textbox", { name: "Proof title" })
    expect(title).toHaveValue("Product card resize study")
    expect(screen.getByText("Context")).toBeInTheDocument()
    expect(screen.getByText("What I did")).toBeInTheDocument()
    expect(screen.getByText("Outcome")).toBeInTheDocument()

    fireEvent.change(title, { target: { value: "Checkout study rewrite" } })
    expect(title).toHaveValue("Checkout study rewrite")

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }))
    expect(screen.getByText("Timeline preview")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Expand all" })
    ).toBeInTheDocument()
  })

  it("uses the shared Coach dock — no AI assist popover or mode picker", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(
      screen.queryByRole("button", { name: /AI assist/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "AI assist" })).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Coach" })).not.toBeInTheDocument()

    const dialog = await openCoach()
    expect(messageCoach(dialog)).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Coach mode" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("radiogroup", { name: "Coach mode" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", {
        name: "Sharpen my checkout project bullet",
      })
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole("log", { name: "Thread" })).not.toBeInTheDocument()
  })

  it("opens the Coach float without shrinking the canvas scroll area", async () => {
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const canvas = editor.querySelector("[data-paper-canvas]")
    expect(canvas).toBeInstanceOf(HTMLElement)
    Object.defineProperty(canvas, "clientHeight", {
      configurable: true,
      value: 640,
    })
    expect((canvas as HTMLElement).clientHeight).toBe(640)

    const dialog = await openCoach()
    expect((canvas as HTMLElement).clientHeight).toBe(640)
    expect(canvas).toHaveClass("flex-1")
    expect(dialog.className).toMatch(/fixed/)
    expect(editor.contains(dialog)).toBe(false)
  })

  it("cycles pill, open, minimize, and close and persists the float state", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(localStorage.getItem("openpath:paper:coach-float")).toBe("closed")

    const dialog = await openCoach()
    expect(localStorage.getItem("openpath:paper:coach-float")).toBe("open")
    expect(messageCoach(dialog)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Minimize" }))
    expect(localStorage.getItem("openpath:paper:coach-float")).toBe("minimized")
    expect(screen.getByRole("dialog", { name: "Coach" })).toHaveAttribute(
      "data-coach-float-state",
      "minimized"
    )
    expect(
      screen.queryByRole("textbox", { name: "Message Coach" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    expect(localStorage.getItem("openpath:paper:coach-float")).toBe("open")
    expect(messageCoach()).toBeInTheDocument()

    fireEvent.click(within(coachDialog()).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog", { name: "Coach" })).not.toBeInTheDocument()
    expect(localStorage.getItem("openpath:paper:coach-float")).toBe("closed")
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()

    cleanup()
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Coach" })).not.toBeInTheDocument()

    localStorage.setItem("openpath:paper:coach-float", "minimized")
    cleanup()
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    expect(await screen.findByRole("dialog", { name: "Coach" })).toHaveAttribute(
      "data-coach-float-state",
      "minimized"
    )
  })

  it("shows a removable soft-scope chip for the open Paper CV", async () => {
    scriptCoachStream({ texts: ["I can still help without the CV."] })
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()

    const chip = within(dialog).getByRole("status", { name: "In context" })
    expect(chip).toHaveTextContent("PM track CV")
    expect(dialog.querySelector("[data-coach-soft-scope]")).toBe(chip)
    expect(dialog).not.toHaveTextContent(/knowledge.?base/i)
    expect(dialog).not.toHaveTextContent(/add sources/i)
    expect(
      within(dialog).queryByRole("button", { name: /sources library/i })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("complementary", { name: /sources/i })
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(chip).getByRole("button", { name: "Remove from context" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "In context" })
    ).not.toBeInTheDocument()
    expect(dialog.querySelector("[data-coach-soft-scope]")).toBeNull()

    fireEvent.click(within(dialog).getByRole("button", { name: "Minimize" }))
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    const restored = coachDialog()
    expect(
      within(restored).queryByRole("status", { name: "In context" })
    ).not.toBeInTheDocument()

    fireEvent.change(messageCoach(restored), {
      target: { value: "What should I cut?" },
    })
    fireEvent.click(within(restored).getByRole("button", { name: "Send" }))
    expect(
      await within(restored).findByText("I can still help without the CV.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.text).toBe("What should I cut?")
    expect(getLastCoachRequest()?.focusDocId).toBeUndefined()
  })

  it("adds a durable selection chip that survives Clear and can be removed", async () => {
    scriptCoachStream({ texts: ["I read that bullet."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    const bulletText = bullet!.textContent ?? ""
    selectNodeContents(bullet!)
    messageCoach(dialog).focus()
    collapseWindowSelection()

    const preview = await within(dialog).findByRole("status", {
      name: "Selected text",
    })
    fireEvent.click(
      within(preview).getByRole("button", { name: "Add to context" })
    )
    const chip = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    expect(chip).toHaveTextContent(bulletText.slice(0, 24))
    expect(chip).toHaveAttribute("data-coach-context-chip")
    expect(chip).toHaveAttribute("data-kind", "selection")
    expect(chip).toHaveAttribute("data-pinned", "false")
    expect(
      within(preview).getByRole("button", { name: "Add to context" })
    ).toBeDisabled()
    expect(within(preview).getByRole("button", { name: "Add to context" })).toHaveTextContent(
      "Added"
    )
    expect(dialog).not.toHaveTextContent(/knowledge.?base/i)
    expect(dialog).not.toHaveTextContent(/sources library/i)

    fireEvent.click(
      within(preview).getByRole("button", { name: "Clear selection" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "Selected text" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("status", { name: "Selection in context" })
    ).toBeInTheDocument()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "What is weak about this bullet?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I read that bullet.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection?.text).toBe(bulletText)
    expect(
      within(dialog).queryByRole("status", { name: "Selection in context" })
    ).not.toBeInTheDocument()

    scriptCoachStream({ texts: ["Say more?"] })
    fireEvent.change(messageCoach(dialog), {
      target: { value: "And the next line?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(await within(dialog).findByText("Say more?")).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection).toBeUndefined()
  })

  it("pins a selection chip so it stays across turns until unpin", async () => {
    scriptCoachStream({ texts: ["Pinned, first turn."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    const bulletText = bullet!.textContent ?? ""
    selectNodeContents(bullet!)
    messageCoach(dialog).focus()
    collapseWindowSelection()

    fireEvent.click(
      within(
        await within(dialog).findByRole("status", { name: "Selected text" })
      ).getByRole("button", { name: "Add to context" })
    )
    const chip = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    fireEvent.click(within(chip).getByRole("button", { name: "Pin in context" }))
    expect(chip).toHaveAttribute("data-pinned", "true")
    expect(within(chip).getByRole("button", { name: "Unpin" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Keep this bullet in mind" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("Pinned, first turn.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection?.text).toBe(bulletText)
    const sticky = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    expect(sticky).toHaveAttribute("data-pinned", "true")

    scriptCoachStream({ texts: ["Pinned, second turn."] })
    fireEvent.change(messageCoach(dialog), {
      target: { value: "Still that bullet?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("Pinned, second turn.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection?.text).toBe(bulletText)

    const leftover = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    fireEvent.click(within(leftover).getByRole("button", { name: "Unpin" }))
    expect(leftover).toHaveAttribute("data-pinned", "false")
    fireEvent.click(
      within(leftover).getByRole("button", { name: "Remove from context" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "Selection in context" })
    ).not.toBeInTheDocument()
  })

  it("attaches the open Paper doc as a visible chip that can coexist with soft-scope", async () => {
    scriptCoachStream({ texts: ["I have the CV attached."] })
    const { router } = renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(
      within(dialog).getByRole("status", { name: "In context" })
    ).toHaveTextContent("PM track CV")

    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Attach from Paper" })
    )
    expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    const attached = within(dialog).getByRole("status", {
      name: "Attached from Paper",
    })
    expect(attached).toHaveTextContent("PM track CV")
    expect(attached).toHaveAttribute("data-kind", "doc")
    expect(dialog.querySelector("[data-coach-soft-scope]")).toBeTruthy()
    expect(dialog).not.toHaveTextContent(/knowledge.?base/i)
    expect(dialog).not.toHaveTextContent(/add sources/i)
    expect(
      within(dialog).queryByRole("complementary", { name: /sources/i })
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(
        within(dialog).getByRole("status", { name: "In context" })
      ).getByRole("button", { name: "Remove from context" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "In context" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("status", { name: "Attached from Paper" })
    ).toBeInTheDocument()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Read the attached CV" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I have the CV attached.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.focusDocId).toBe(
      "11111111-1111-7111-8111-111111111111"
    )
    expect(
      within(dialog).queryByRole("status", { name: "Attached from Paper" })
    ).not.toBeInTheDocument()
  })

  it("offers one cite that scrolls and highlights the matching Experience bullet", async () => {
    const scrollIntoView = vi.fn()
    const originalScroll = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    scriptCoachStream({
      texts: [
        "The checkout UX hallway study is thin. Tighten the add-to-cart line so a recruiter can see the 18% lift.",
      ],
    })
    try {
      renderPaper()
      await expectPaperDrive()
      const editor = await openDoc("PM track CV")
      const dialog = await openCoach()

      expect(
        within(dialog).getByRole("status", { name: "In context" })
      ).toHaveTextContent("PM track CV")

      fireEvent.change(messageCoach(dialog), {
        target: {
          value: "What should I change about the checkout UX bullet?",
        },
      })
      fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
      expect(
        await within(dialog).findByText(
          "The checkout UX hallway study is thin. Tighten the add-to-cart line so a recruiter can see the 18% lift."
        )
      ).toBeInTheDocument()

      const cite = within(dialog).getByRole("button", {
        name: /Show on Paper:.*Checkout UX/,
      })
      expect(cite).toHaveAttribute("data-coach-cite", "experience-1-bullet-1")
      expect(
        within(dialog).getAllByRole("button", { name: /Show on Paper/ })
      ).toHaveLength(1)
      expect(dialog).not.toHaveTextContent(/provenance/i)
      expect(dialog).not.toHaveTextContent(/sources rail/i)
      expect(
        within(dialog).queryByRole("complementary", { name: /sources/i })
      ).not.toBeInTheDocument()

      fireEvent.click(cite)
      const bullet = editor.querySelector(
        '[data-paper-section="experience-1-bullet-1"]'
      )
      expect(bullet).toHaveClass("paper-coach-changed")
      expect(scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: "center" })
      )
      expect(
        within(dialog).getByRole("status", { name: "In context" })
      ).toBeInTheDocument()
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll
    }
  })

  it("cites a durable selection chip when the reply is generic", async () => {
    scriptCoachStream({ texts: ["I read that bullet."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    const bulletText = bullet!.textContent ?? ""
    selectNodeContents(bullet!)
    messageCoach(dialog).focus()
    collapseWindowSelection()

    fireEvent.click(
      within(
        await within(dialog).findByRole("status", { name: "Selected text" })
      ).getByRole("button", { name: "Add to context" })
    )
    expect(
      within(dialog).getByRole("status", { name: "Selection in context" })
    ).toBeInTheDocument()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "What is weak about this bullet?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I read that bullet.")
    ).toBeInTheDocument()

    const cite = within(dialog).getByRole("button", { name: /Show on Paper/ })
    expect(cite).toHaveAttribute(
      "data-coach-cite",
      expect.stringMatching(/^experience-0-bullet-0$/)
    )
    expect(getLastCoachRequest()?.selection?.text).toBe(bulletText)
    expect(
      within(dialog).getByRole("status", { name: "In context" })
    ).toBeInTheDocument()
  })

  it("keeps a chip-grounded cite after the next Coach turn", async () => {
    scriptCoachStream({ texts: ["I read that bullet."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    selectNodeContents(bullet!)
    messageCoach(dialog).focus()
    collapseWindowSelection()

    fireEvent.click(
      within(
        await within(dialog).findByRole("status", { name: "Selected text" })
      ).getByRole("button", { name: "Add to context" })
    )
    const chip = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    fireEvent.click(within(chip).getByRole("button", { name: "Pin in context" }))
    expect(chip).toHaveAttribute("data-pinned", "true")

    fireEvent.change(messageCoach(dialog), {
      target: { value: "What is weak about this bullet?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I read that bullet.")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: /Show on Paper/ })
    ).toHaveAttribute("data-coach-cite", "experience-0-bullet-0")

    scriptCoachStream({ texts: ["Say more?"] })
    fireEvent.change(messageCoach(dialog), {
      target: { value: "And the next line?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(await within(dialog).findByText("Say more?")).toBeInTheDocument()
    expect(within(dialog).getByText("I read that bullet.")).toBeInTheDocument()

    const cites = within(dialog).getAllByRole("button", {
      name: /Show on Paper/,
    })
    expect(
      cites.some((button) => button.getAttribute("data-coach-cite") === "experience-0-bullet-0")
    ).toBe(true)
    expect(
      within(dialog).getByRole("status", { name: "Selection in context" })
    ).toHaveAttribute("data-pinned", "true")
  })

  it("does not invent a cite or sources rail for generic advice", async () => {
    scriptCoachStream({
      texts: [
        "Write one Proof with a concrete outcome. That is the next step.",
      ],
    })
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()
    fireEvent.change(messageCoach(dialog), {
      target: { value: "What should I do this week?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText(
        "Write one Proof with a concrete outcome. That is the next step."
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: /Show on Paper/ })
    ).not.toBeInTheDocument()
    expect(dialog.querySelector("[data-coach-cite]")).toBeNull()
    expect(dialog).not.toHaveTextContent(/provenance/i)
    expect(
      within(dialog).queryByRole("complementary", { name: /sources/i })
    ).not.toBeInTheDocument()
  })

  it("closes the float on Escape and returns focus to the pill", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    const pill = screen.getByRole("button", { name: "Coach" })
    pill.focus()
    fireEvent.click(pill)
    const dialog = await screen.findByRole("dialog", { name: "Coach" })
    fireEvent.keyDown(dialog, { key: "Escape" })

    expect(screen.queryByRole("dialog", { name: "Coach" })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach" })).toHaveFocus()
    })
  })

  it("opens a mobile sheet with a backdrop and focus trap", async () => {
    stubDesktopViewport(false)
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(document.querySelector("[data-coach-float-backdrop]")).toBeInTheDocument()
    expect(dialog).toHaveAttribute("aria-modal", "true")

    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ),
    ]
    expect(focusable.length).toBeGreaterThan(1)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    last?.focus()
    fireEvent.keyDown(dialog, { key: "Tab" })
    expect(first).toHaveFocus()
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
    expect(last).toHaveFocus()
  })

  it("auto-minimizes on canvas focus so the CV stays editable, then restores the Thread", async () => {
    scriptCoachStream({ texts: ["Keep the checkout metric."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(dialog.className).toContain(COACH_FLOAT_DESKTOP_OPEN_HEIGHT_CLASS)
    expect(dialog.className).not.toMatch(/70vh/)
    expect(dialog).not.toHaveAttribute("draggable")
    expect(dialog.querySelector("[data-coach-float-resize]")).toBeNull()
    expect(dialog.className).not.toMatch(/resize-/)

    const canvas = editor.querySelector("[data-paper-canvas]")
    expect(canvas).toBeInstanceOf(HTMLElement)
    expect(canvas).toHaveAttribute(COACH_FLOAT_NUDGE_ATTR)

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Sharpen the checkout bullet" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("Keep the checkout metric.")
    ).toBeInTheDocument()

    const thread = dialog.querySelector("[data-coach-float-thread]")
    const viewport = dialog.querySelector("[data-coach-thread-viewport]")
    expect(thread).toBeInstanceOf(HTMLElement)
    expect(viewport).toBeInstanceOf(HTMLElement)
    if (viewport instanceof HTMLElement) viewport.scrollTop = 48
    const rememberedScroll =
      viewport instanceof HTMLElement ? viewport.scrollTop : 0

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    fireEvent.pointerDown(summary)
    fireEvent.focusIn(summary)

    const minimized = screen.getByRole("dialog", { name: "Coach" })
    expect(minimized).toHaveAttribute("data-coach-float-state", "minimized")
    expect(localStorage.getItem("openpath:paper:coach-float")).toBe("minimized")
    expect(canvas).not.toHaveAttribute(COACH_FLOAT_NUDGE_ATTR)
    expect(
      screen.queryByRole("textbox", { name: "Message Coach" })
    ).not.toBeInTheDocument()
    expect(minimized.querySelector("[data-coach-float-thread]")).toBe(thread)

    summary.textContent = "Edited while Coach is tucked away."
    fireEvent.input(summary)
    expect(summary).toHaveTextContent("Edited while Coach is tucked away.")

    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    const restored = screen.getByRole("dialog", { name: "Coach" })
    expect(restored).toHaveAttribute("data-coach-float-state", "open")
    expect(canvas).toHaveAttribute(COACH_FLOAT_NUDGE_ATTR)
    expect(restored.querySelector("[data-coach-float-thread]")).toBe(thread)
    expect(
      within(restored).getByText("Keep the checkout metric.")
    ).toBeInTheDocument()
    expect(
      within(restored).getByText("Sharpen the checkout bullet")
    ).toBeInTheDocument()
    if (rememberedScroll > 0) {
      expect(restored.querySelector("[data-coach-thread-viewport]")).toHaveProperty(
        "scrollTop",
        rememberedScroll
      )
    }

    fireEvent.keyDown(restored, { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: "Coach" })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach" })).toHaveFocus()
    })
  })

  it("does not auto-minimize the mobile sheet on canvas focus", async () => {
    stubDesktopViewport(false)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    await openCoach()

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    fireEvent.pointerDown(summary)
    fireEvent.focusIn(summary)

    expect(screen.getByRole("dialog", { name: "Coach" })).toHaveAttribute(
      "data-coach-float-state",
      "open"
    )
    expect(editor.querySelector("[data-paper-canvas]")).not.toHaveAttribute(
      COACH_FLOAT_NUDGE_ATTR
    )
  })

  it("streams the shared Coach with a receipt, stop, retry, thumbs, and copy", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "I read PM track CV." },
        {
          kind: "tool",
          name: "paper_updateContent",
          summary: "Updated PM track CV",
          ok: true,
          reversal: {
            possible: true,
            description: "Undo by editing the document again.",
          },
        },
      ],
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(editor).not.toHaveTextContent(/can't edit it yet/i)
    expect(editor).not.toHaveTextContent(/haven't edited this document/i)
    expect(editor).not.toHaveTextContent(/lives on Home/i)
    expect(
      within(dialog).queryByRole("radiogroup", { name: "Coach mode" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Coach mode" })
    ).not.toBeInTheDocument()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Sharpen the checkout bullet" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))

    expect(
      await within(dialog).findByText("I read PM track CV.")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("log", { name: "Thread" })
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", {
        name: "Sharpen my checkout project bullet",
      })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByText("Updated PM track CV")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("status", { name: "Command succeeded" })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText("Reversible — Undo by editing the document again.")
    ).toBeInTheDocument()
    const thread = within(dialog).getByRole("log", { name: "Thread" })
    await waitFor(() => {
      expect(within(thread).getByRole("button", { name: "Undo" })).toBeEnabled()
    })
    expect(getLastCoachRequest()?.focusDocId).toBe(
      "11111111-1111-7111-8111-111111111111"
    )
    expect(getLastCoachRequest()?.text).toBe("Sharpen the checkout bullet")
    expect(
      getMockThreads().some(
        (thread) =>
          thread.title === "PM track CV" &&
          thread.focusDocId === "11111111-1111-7111-8111-111111111111"
      )
    ).toBe(true)
    expect(
      Object.keys(sessionStorage).some((key) =>
        key.includes("paper-coach-thread")
      )
    ).toBe(false)

    fireEvent.click(within(dialog).getByRole("button", { name: "Copy" }))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Good response" }))
    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Good response" })
      ).toHaveAttribute("aria-pressed", "true")
    })
  })

  it("stops a Paper Coach turn and retries a failed send", async () => {
    const stream = scriptCoachStream({
      gated: true,
      texts: ["Partial from Paper", " should not appear"],
    })
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Stop me" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    const working = within(dialog).getByRole("status", { name: "Coach is working" })
    expect(working).toHaveTextContent("Working…")
    expect(
      working.querySelector("[data-slot='coach-working-bar']")
    ).toBeInTheDocument()
    expect(working.querySelector(".animate-pulse")).not.toBeInTheDocument()
    stream.release(2)
    expect(await within(dialog).findByText("Partial from Paper")).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Stop" }))
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "Send" })).toBeInTheDocument()
    })
    expect(within(dialog).getByText("Partial from Paper")).toBeInTheDocument()
    expect(within(dialog).queryByText(/should not appear/)).not.toBeInTheDocument()

    scriptCoachStream({
      httpError: {
        status: 503,
        code: "COACH_UNAVAILABLE",
        message: "The Coach is unavailable right now",
      },
    })
    fireEvent.change(messageCoach(dialog), {
      target: { value: "Are you there?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The Coach is unavailable right now. Try again in a moment."
    )

    scriptCoachStream({ texts: [DEFAULT_COACH_STREAM_REPLY] })
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }))
    expect(
      await within(dialog).findByText(DEFAULT_COACH_STREAM_REPLY)
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument()
    })
  })

  it("rebinds the Paper Coach Thread from GET after remount", async () => {
    scriptCoachStream({ texts: ["I read PM track CV."] })
    const first = renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const firstDialog = await openCoach()

    fireEvent.change(messageCoach(firstDialog), {
      target: { value: "Remember this CV" },
    })
    fireEvent.click(within(firstDialog).getByRole("button", { name: "Send" }))
    expect(
      await within(firstDialog).findByText("I read PM track CV.")
    ).toBeInTheDocument()

    const grounded = getMockThreads().find(
      (thread) => thread.focusDocId === "11111111-1111-7111-8111-111111111111"
    )
    expect(grounded?.messages.some((message) => message.text === "Remember this CV")).toBe(
      true
    )

    first.unmount()
    cleanup()

    renderPaper()
    await expectPaperDrive()
    const driveName = await screen.findByText("PM track CV", {
      selector: "span.font-medium",
    })
    fireEvent.click(driveName.closest("tr") ?? driveName)
    await screen.findByRole("region", {
      name: "Editing PM track CV",
    })
    const secondDialog = await screen.findByRole("dialog", { name: "Coach" })
    expect(
      await within(secondDialog).findByText("Remember this CV")
    ).toBeInTheDocument()
    expect(within(secondDialog).getByText("I read PM track CV.")).toBeInTheDocument()
    expect(
      Object.keys(sessionStorage).some((key) =>
        key.includes("paper-coach-thread")
      )
    ).toBe(false)
  })

  it("shows the Paper Thread in History and continues it on Home", async () => {
    scriptCoachStream({ texts: ["I read PM track CV."] })
    const { router } = renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Sharpen the checkout bullet" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I read PM track CV.")
    ).toBeInTheDocument()

    const history = screen.getByRole("navigation", { name: "History" })
    expect(
      await within(history).findByRole("button", { name: "PM track CV" })
    ).toBeInTheDocument()

    fireEvent.click(within(history).getByRole("button", { name: "PM track CV" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)
    })
    const thread = await screen.findByRole("log", { name: "Thread" })
    expect(thread).toHaveTextContent("Sharpen the checkout bullet")
    expect(thread).toHaveTextContent("I read PM track CV.")
  })

  it("disables Rewrite selection until the User selects text, then sends it", async () => {
    scriptCoachStream({ texts: ["I will rewrite that line."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("Cover: Associate PM intern")
    const dialog = await openCoach()

    const rewrite = within(dialog).getByRole("button", {
      name: "Rewrite selection",
    })
    expect(rewrite).toBeDisabled()

    const canvas = within(editor).getByRole("textbox", {
      name: "Document content",
    })
    selectNodeContents(canvas)

    await waitFor(() => {
      expect(rewrite).toBeEnabled()
    })
    expect(
      within(dialog).getByRole("status", { name: "Selected text" })
    ).toBeInTheDocument()
    fireEvent.click(rewrite)
    expect(
      await within(dialog).findByText("I will rewrite that line.")
    ).toBeInTheDocument()
    const request = getLastCoachRequest()
    expect(request?.text).toBe("Rewrite selection")
    expect(request?.selection?.text?.length).toBeGreaterThan(0)
    expect(request?.selection?.sectionId).toBe("letter")
  })

  it("keeps a CV selection after the float composer is focused", async () => {
    scriptCoachStream({ texts: ["I rewrote that bullet."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    expect(bullet).toBeTruthy()
    const bulletText = bullet!.textContent ?? ""
    expect(bulletText.length).toBeGreaterThan(0)
    selectNodeContents(bullet!)

    const dialog = await openCoach()
    const composer = messageCoach(dialog)
    composer.focus()
    collapseWindowSelection()

    const preview = await within(dialog).findByRole("status", {
      name: "Selected text",
    })
    expect(preview).toHaveTextContent(bulletText.slice(0, 24))

    const rewrite = within(dialog).getByRole("button", {
      name: "Rewrite selection",
    })
    expect(rewrite).toBeEnabled()
    fireEvent.click(rewrite)
    expect(
      await within(dialog).findByText("I rewrote that bullet.")
    ).toBeInTheDocument()
    const request = getLastCoachRequest()
    expect(request?.text).toBe("Rewrite selection")
    expect(request?.selection?.text).toBe(bulletText)
  })

  it("keeps Rewrite selection available after a Coach turn when a selection is held", async () => {
    scriptCoachStream({ texts: ["I sharpened the checkout bullet."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Sharpen the checkout bullet" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I sharpened the checkout bullet.")
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Rewrite selection" })
    ).not.toBeInTheDocument()

    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    const bulletText = bullet!.textContent ?? ""
    selectNodeContents(bullet!)

    const composer = messageCoach(dialog)
    composer.focus()
    collapseWindowSelection()

    const preview = await within(dialog).findByRole("status", {
      name: "Selected text",
    })
    expect(preview).toHaveTextContent(bulletText.slice(0, 24))

    scriptCoachStream({ texts: ["I rewrote that bullet."] })
    const rewrite = within(dialog).getByRole("button", {
      name: "Rewrite selection",
    })
    expect(rewrite).toBeEnabled()
    fireEvent.click(rewrite)
    expect(
      await within(dialog).findByText("I rewrote that bullet.")
    ).toBeInTheDocument()
    const request = getLastCoachRequest()
    expect(request?.text).toBe("Rewrite selection")
    expect(request?.selection?.text).toBe(bulletText)
  })

  it("drops a held selection after a Coach turn so the next send omits it", async () => {
    scriptCoachStream({ texts: ["I read the CV."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Read this CV" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(await within(dialog).findByText("I read the CV.")).toBeInTheDocument()

    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    selectNodeContents(bullet!)

    messageCoach(dialog).focus()
    collapseWindowSelection()

    expect(
      await within(dialog).findByRole("status", { name: "Selected text" })
    ).toBeInTheDocument()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Clear selection" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "Selected text" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Rewrite selection" })
    ).not.toBeInTheDocument()

    scriptCoachStream({ texts: ["What should I rewrite?"] })
    fireEvent.change(messageCoach(dialog), {
      target: { value: "Rewrite the selected café experience" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("What should I rewrite?")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection).toBeUndefined()
  })

  it("drops the held selection when the float preview is dismissed", async () => {
    scriptCoachStream({ texts: ["What should I rewrite?"] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    selectNodeContents(bullet!)

    const dialog = await openCoach()
    messageCoach(dialog).focus()
    collapseWindowSelection()

    expect(
      await within(dialog).findByRole("status", { name: "Selected text" })
    ).toBeInTheDocument()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Clear selection" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "Selected text" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "Rewrite selection" })
    ).toBeDisabled()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Rewrite the selected café experience" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("What should I rewrite?")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection).toBeUndefined()
  })

  it("reloads the open canvas when Coach updates the doc", async () => {
    const { defaultCvData } = await import("@/features/paper/paper-cv-types.ts")
    const { SAMPLE_AUTHOR } = await import("@/features/seed/sample-author.ts")
    const { patchMockPaperDoc } = await import("@/test/paper-api-mock.ts")
    scriptCoachStream({
      parts: [
        { kind: "text", text: "I updated the summary." },
        {
          kind: "tool",
          name: "paper_updateContent",
          summary: "Updated content of PM track CV",
          ok: true,
          reversal: {
            possible: true,
            description: "Undo by writing the previous content back.",
          },
        },
      ],
    })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    expect(summary).not.toHaveTextContent(
      "Coach rewrote the summary for APM internships."
    )

    const next = defaultCvData(SAMPLE_AUTHOR)
    next.summary = "Coach rewrote the summary for APM internships."
    patchMockPaperDoc("11111111-1111-7111-8111-111111111111", {
      content: next,
      updatedAt: "2026-08-26T12:00:00.000Z",
    })

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Rewrite the summary" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I updated the summary.")
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        within(editor).getByRole("textbox", { name: "Summary" })
      ).toHaveTextContent("Coach rewrote the summary for APM internships.")
    })
    await waitFor(() => {
      expect(
        within(editor).getByRole("textbox", { name: "Summary" })
      ).toHaveClass("paper-coach-changed")
    })
  })

  it("scrolls Coach edits instantly when the User prefers reduced motion", async () => {
    const { paperQueryKeys } = await import("@/features/paper/paper-api.ts")
    const scrollIntoView = vi.fn()
    const originalScroll = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }))

    try {
      const { queryClient } = renderPaper()
      await expectPaperDrive()
      const panel = await openDoc("PM track CV")
      const docs = queryClient.getQueryData(paperQueryKeys.list()) as Array<{
        id: string
        updatedAt: string
        content: { summary?: string }
      }>
      queryClient.setQueryData(
        paperQueryKeys.list(),
        docs.map((doc) =>
          doc.id === "11111111-1111-7111-8111-111111111111"
            ? {
                ...doc,
                updatedAt: "2026-08-26T15:00:00.000Z",
                content: {
                  ...doc.content,
                  summary: "Coach version of the summary",
                },
              }
            : doc
        )
      )

      await waitFor(() => {
        expect(
          within(panel).getByRole("textbox", { name: "Summary" })
        ).toHaveClass("paper-coach-changed")
      })
      expect(scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "auto" })
      )
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll
    }
  })

  it("asks Keep mine or Use Coach's version when the canvas is dirty", async () => {
    const { paperQueryKeys } = await import("@/features/paper/paper-api.ts")
    const { queryClient } = renderPaper()
    await expectPaperDrive()
    const panel = await openDoc("PM track CV")
    const summary = within(panel).getByRole("textbox", { name: "Summary" })
    summary.textContent = "My local edit that should stay"
    fireEvent.input(summary)

    const docs = queryClient.getQueryData(paperQueryKeys.list()) as Array<{
      id: string
      updatedAt: string
      content: { summary?: string }
    }>
    queryClient.setQueryData(
      paperQueryKeys.list(),
      docs.map((doc) =>
        doc.id === "11111111-1111-7111-8111-111111111111"
          ? {
              ...doc,
              updatedAt: "2026-08-26T15:00:00.000Z",
              content: { ...doc.content, summary: "Coach version of the summary" },
            }
          : doc
      )
    )

    expect(
      await within(panel).findByRole("alert")
    ).toHaveTextContent("Coach updated this document")
    expect(summary).toHaveTextContent("My local edit that should stay")

    fireEvent.click(within(panel).getByRole("button", { name: "Keep mine" }))
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
    expect(summary).toHaveTextContent("My local edit that should stay")

    summary.textContent = "Another local edit"
    fireEvent.input(summary)
    queryClient.setQueryData(
      paperQueryKeys.list(),
      docs.map((doc) =>
        doc.id === "11111111-1111-7111-8111-111111111111"
          ? {
              ...doc,
              updatedAt: "2026-08-26T16:00:00.000Z",
              content: {
                ...doc.content,
                summary: "Coach version of the summary",
              },
            }
          : doc
      )
    )
    expect(
      await within(panel).findByRole("alert")
    ).toHaveTextContent("Coach updated this document")
    fireEvent.click(
      within(panel).getByRole("button", { name: "Use Coach's version" })
    )
    await waitFor(() => {
      expect(
        within(panel).getByRole("textbox", { name: "Summary" })
      ).toHaveTextContent("Coach version of the summary")
    })
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
  })

  it("applies a Coach paper.updateContent receipt to the open CV without paste", async () => {
    const { defaultCvData } = await import("@/features/paper/paper-cv-types.ts")
    const { SAMPLE_AUTHOR } = await import("@/features/seed/sample-author.ts")
    const { patchMockPaperDoc } = await import("@/test/paper-api-mock.ts")
    const next = defaultCvData(SAMPLE_AUTHOR)
    next.summary =
      "I ship small product experiments and back them with user notes."
    scriptCoachStream({
      parts: [
        { kind: "text", text: "I shortened the summary to one sentence." },
        {
          kind: "tool",
          name: "paper_updateContent",
          summary: "Updated content of PM track CV",
          ok: true,
          reversal: {
            possible: true,
            description: "Undo by writing the previous content back.",
          },
          detail: {
            type: "paper.updateContent",
            docKind: "cv",
            docName: "PM track CV",
            hunks: [
              {
                section: "Summary",
                sectionId: "summary",
                lines: [
                  {
                    kind: "del",
                    text: "Year-4 Information Systems student targeting associate product manager roles.",
                  },
                  { kind: "add", text: next.summary },
                ],
              },
            ],
          },
        },
      ],
    })
    renderPaper()
    await expectPaperDrive()
    const panel = await openDoc("PM track CV")
    expect(
      within(panel).getByRole("textbox", { name: "Summary" })
    ).not.toHaveTextContent(next.summary)

    patchMockPaperDoc("11111111-1111-7111-8111-111111111111", {
      content: next,
      updatedAt: "2026-08-26T18:00:00.000Z",
    })

    const dialog = await openCoach()
    fireEvent.change(messageCoach(dialog), {
      target: { value: "Rewrite the Experience checkout bullet for a product internship" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))

    expect(
      await within(dialog).findByText("I shortened the summary to one sentence.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.focusDocId).toBe(
      "11111111-1111-7111-8111-111111111111"
    )
    expect(getLastCoachRequest()?.selection).toBeUndefined()
    expect(getLastCoachRequest()?.text).toBe(
      "Rewrite the Experience checkout bullet for a product internship"
    )
    expect(within(dialog).getByText("Updated CV PM track CV")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("status", { name: "Command succeeded" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        within(panel).getByRole("textbox", { name: "Summary" })
      ).toHaveTextContent(next.summary)
    })
    expect(panel).not.toHaveTextContent(/paste/i)
  })

  it("states a failed paper.updateContent in one plain line with no paste advice", async () => {
    scriptCoachStream({
      parts: [
        {
          kind: "text",
          text: "Couldn't update PM track CV. Try sending the rewrite again.",
        },
        {
          kind: "tool",
          name: "paper_updateContent",
          summary: "Paper doc not found",
          ok: false,
        },
      ],
    })
    renderPaper()
    await expectPaperDrive()
    const panel = await openDoc("PM track CV")
    const before = within(panel).getByRole("textbox", {
      name: "Summary",
    }).textContent

    const dialog = await openCoach()
    fireEvent.change(messageCoach(dialog), {
      target: { value: "Make my summary one sentence" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))

    expect(
      await within(dialog).findByText(
        "Couldn't update PM track CV. Try sending the rewrite again."
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("status", { name: "Command failed" })
    ).toHaveTextContent("Paper doc not found")
    expect(dialog).not.toHaveTextContent(/paste/i)
    expect(within(panel).getByRole("textbox", { name: "Summary" })).toHaveTextContent(
      before ?? ""
    )
  })
})

describe("Paper documents panel", () => {
  it("hides and shows the sidebar so the canvas can use full width", async () => {
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    const header = editor.querySelector("header")
    expect(header).not.toBeNull()
    const toggle = within(header as HTMLElement).getByRole("button", {
      name: "Documents",
    })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(toggle).toHaveAttribute("aria-controls", "paper-docs-panel")
    expect(toggle.textContent?.trim()).toBe("")

    const sidebar = screen.getByRole("complementary", { name: "Documents" })
    expect(sidebar).toHaveAttribute("id", "paper-docs-panel")
    expect(sidebar).toHaveClass("w-60")
    expect(editor.children).toHaveLength(2)

    const docRow = within(sidebar).getByRole("button", { name: /PM track CV/ })
    expect(docRow).toHaveClass("justify-start")
    expect(docRow).toHaveClass("text-left")
    expect(docRow).not.toHaveClass("justify-center")

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(editor.querySelector(".w-60")).toBeNull()
    expect(editor.children).toHaveLength(1)
    expect(editor.firstElementChild).toHaveClass("flex-1")
    expect(localStorage.getItem("openpath:paper:docs-panel")).toBe("collapsed")

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByRole("complementary", { name: "Documents" })
    ).toBeInTheDocument()
    expect(editor.children).toHaveLength(2)
    expect(localStorage.getItem("openpath:paper:docs-panel")).toBe("expanded")
  })

  it("restores a saved collapsed preference after remount", async () => {
    localStorage.setItem("openpath:paper:docs-panel", "collapsed")
    const first = renderPaper()
    await expectPaperDrive()
    const firstEditor = await openDoc("PM track CV")

    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(firstEditor.children).toHaveLength(1)
    expect(firstEditor.firstElementChild).toHaveClass("flex-1")

    first.unmount()
    cleanup()

    renderPaper()
    await expectPaperDrive()
    const secondEditor = await openDoc("PM track CV")
    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(secondEditor.children).toHaveLength(1)
    expect(localStorage.getItem("openpath:paper:docs-panel")).toBe("collapsed")
  })

  it("defaults expanded on first visit and ignores invalid storage", async () => {
    localStorage.setItem("openpath:paper:docs-panel", "hidden")
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(
      screen.getByRole("complementary", { name: "Documents" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("leaves the drive view without a documents panel or toggle", async () => {
    renderPaper()
    await expectPaperDrive()

    expect(
      screen.queryByRole("button", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Paper" })).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Search documents" })
    ).toBeInTheDocument()
  })
})
