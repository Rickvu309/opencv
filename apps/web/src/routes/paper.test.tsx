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
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
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
    const range = document.createRange()
    range.selectNodeContents(canvas)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    document.dispatchEvent(new Event("selectionchange"))

    await waitFor(() => {
      expect(rewrite).toBeEnabled()
    })
    fireEvent.click(rewrite)
    expect(
      await within(dialog).findByText("I will rewrite that line.")
    ).toBeInTheDocument()
    const request = getLastCoachRequest()
    expect(request?.text).toBe("Rewrite selection")
    expect(request?.selection?.text?.length).toBeGreaterThan(0)
    expect(request?.selection?.sectionId).toBe("letter")
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
})
