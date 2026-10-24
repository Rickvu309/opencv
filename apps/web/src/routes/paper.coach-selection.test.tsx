import { describe, expect, it, vi } from "vitest"
import { fireEvent, waitFor, within } from "@testing-library/react"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  getLastCoachRequest,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"
import {
  installPaperTestLifecycle,
  renderPaper,
  openDoc,
  openCoach,
  messageCoach,
  selectNodeContents,
  collapseWindowSelection,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

describe("Paper Coach selection and doc updates", () => {
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
    expect(
      await within(dialog).findByText("I read the CV.")
    ).toBeInTheDocument()

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
              content: {
                ...doc.content,
                summary: "Coach version of the summary",
              },
            }
          : doc
      )
    )

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "Coach updated this document"
    )
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
    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "Coach updated this document"
    )
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
      target: {
        value:
          "Rewrite the Experience checkout bullet for a product internship",
      },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))

    expect(
      await within(dialog).findByText(
        "I shortened the summary to one sentence."
      )
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.focusDocId).toBe(
      "11111111-1111-7111-8111-111111111111"
    )
    expect(getLastCoachRequest()?.selection).toBeUndefined()
    expect(getLastCoachRequest()?.text).toBe(
      "Rewrite the Experience checkout bullet for a product internship"
    )
    expect(
      within(dialog).getByText("Updated CV PM track CV")
    ).toBeInTheDocument()
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
    expect(
      within(panel).getByRole("textbox", { name: "Summary" })
    ).toHaveTextContent(before ?? "")
  })
})
