import { describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  DEFAULT_COACH_STREAM_REPLY,
  getLastCoachRequest,
  getMockThreads,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"
import {
  queryByAttr,
  installPaperTestLifecycle,
  renderPaper,
  openDoc,
  openCoach,
  messageCoach,
  selectNodeContents,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

describe("Paper Coach turns", () => {
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
    expect(within(dialog).getByText("Updated PM track CV")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("status", { name: "Command succeeded" })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        "Reversible — Undo by editing the document again."
      )
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
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Good response" })
    )
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
    const working = within(dialog).getByRole("status", {
      name: "Coach is working",
    })
    expect(working).toHaveTextContent("Working…")
    expect(
      queryByAttr(working, "data-slot='coach-working-bar'")
    ).toBeInTheDocument()
    stream.release(2)
    expect(
      await within(dialog).findByText("Partial from Paper")
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Stop" }))
    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Send" })
      ).toBeInTheDocument()
    })
    expect(within(dialog).getByText("Partial from Paper")).toBeInTheDocument()
    expect(
      within(dialog).queryByText(/should not appear/)
    ).not.toBeInTheDocument()

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
    expect(
      grounded?.messages.some((message) => message.text === "Remember this CV")
    ).toBe(true)

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
    expect(
      within(secondDialog).getByText("I read PM track CV.")
    ).toBeInTheDocument()
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

    fireEvent.click(
      within(history).getByRole("button", { name: "PM track CV" })
    )
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
      name: "Letter text",
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
})
