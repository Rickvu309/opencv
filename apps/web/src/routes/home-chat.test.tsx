import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import {
  DEFAULT_COACH_STREAM_REPLY,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"
import { FIXTURE_THREADS } from "@/test/thread-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectHomeIdle,
  expectSendSettled,
  expectThreadText,
  idleHeading,
  sendMessage,
  stepButton,
} from "@/test/home-chat-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openStoredThread(title: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: "Search" }))
  const dialog = await screen.findByRole("dialog", { name: "Search" })
  fireEvent.click(await within(dialog).findByRole("button", { name: title }))
}

describe("Home Thread mode and History", { timeout: 15_000 }, () => {
  it("streams a reply progressively and drops working status at first text", async () => {
    const stream = scriptCoachStream({
      gated: true,
      texts: ["Hello", " world"],
    })
    renderApp()
    await expectHomeIdle()

    await sendMessage("Help me plan the week")

    const working = within(
      screen.getByRole("log", { name: "Thread" })
    ).getByRole("status")
    expect(working).toHaveTextContent("Thinking")
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Send" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("log", { name: "Thread" })).toHaveTextContent(
      "Help me plan the week"
    )
    expect(
      screen.queryByRole("heading", { name: idleHeading })
    ).not.toBeInTheDocument()

    stream.release(2)
    expect(await screen.findByText("Hello")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Thinking")).not.toBeInTheDocument()
    })
    expect(screen.queryByText("Hello world")).not.toBeInTheDocument()

    stream.releaseAll()
    expect(await screen.findByText("Hello world")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
    })
    expect(screen.getByText("Worked for 1s")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled()
  })

  it("renders a Command receipt with outcome and reversal, including after reload", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "Moved it." },
        {
          kind: "tool",
          name: "job_move",
          summary: "Moved 'Backend Intern' to Prep",
          ok: true,
          reversal: {
            possible: true,
            description:
              "Undo by moving the card back to its previous Stage and order.",
          },
        },
      ],
    })
    const first = renderApp()
    await expectHomeIdle()
    await sendMessage("Move the intern card to Prep")
    await expectSendSettled("Move the intern card to Prep")
    expect(
      await screen.findByRole("button", {
        name: stepButton("Moved 'Backend Intern' to Prep"),
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/^Moved 'Backend Intern' to Prep finished/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Reversible — Undo by moving the card back to its previous Stage and order."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
    first.unmount()

    renderApp()
    await expectHomeIdle()
    await openStoredThread(/Move the intern card to Prep/)
    expect(
      (
        await screen.findAllByRole("button", {
          name: stepButton("Moved 'Backend Intern' to Prep"),
        })
      )[0]
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(
        "Reversible — Undo by moving the card back to its previous Stage and order."
      ).length
    ).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Undo" })[0]).toBeEnabled()
    })
  })

  it("renders the three rich receipt types in the Thread", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "I made those changes." },
        {
          kind: "tool",
          name: "paper_replace",
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
                  { kind: "del", text: "Old summary" },
                  { kind: "add", text: "New summary" },
                ],
              },
            ],
          },
        },
        {
          kind: "tool",
          name: "job_move",
          summary: "Moved Associate PM intern at Local startup to Prep",
          ok: true,
          reversal: {
            possible: true,
            description: "Undo by moving the card back.",
            command: "apply.moveCard",
            input: { cardId: "c1", stage: "inbox" },
          },
          detail: {
            type: "apply.moveCard",
            title: "Associate PM intern",
            company: "Local startup",
            from: "inbox",
            to: "prep",
          },
        },
        {
          kind: "tool",
          name: "paper_create",
          summary: "Created CV Untitled CV",
          ok: true,
          reversal: {
            possible: true,
            description: "Undo by deleting the Paper doc.",
          },
          detail: {
            type: "paper.createDoc",
            docKind: "cv",
            name: "Untitled CV",
            status: "draft",
          },
        },
      ],
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Update my CV, move the card, and start a new CV")
    await expectSendSettled("Update my CV, move the card, and start a new CV")

    expect(
      screen.getByRole("button", { name: stepButton("Updated CV PM track CV") })
    ).toBeInTheDocument()
    expect(screen.getByText("New summary")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Moved Associate PM intern at Local startup from inbox to prep"
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText("inbox to prep")).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", {
        name: stepButton("Created CV Untitled CV"),
      })[0]
    ).toBeInTheDocument()
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(
      screen.queryByText(/Ran paper\.|Ran apply\./)
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /^Undo/ })).toHaveLength(3)
  })

  it("renders markdown in coach replies and leaves user bubbles as plain text", async () => {
    scriptCoachStream({
      texts: ["Try this:\n\n- **star** the card\n- open `Prep`"],
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Show me **markdown** please")

    const thread = await screen.findByRole("log", { name: "Thread" })
    expect(await screen.findByText("star")).toBeInTheDocument()
    expect(thread.querySelector("strong")?.textContent).toBe("star")
    expect(thread.querySelector("code")?.textContent).toBe("Prep")
    expect(screen.getByRole("list")).toBeInTheDocument()
    expect(
      within(thread).getByText("Show me **markdown** please").tagName
    ).toBe("DIV")
    expect(
      within(thread).getByText("Show me **markdown** please").closest("strong")
    ).toBeNull()
  })

  it("copies reply text and offers no rating buttons", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Should I finish my CV first?")
    await expectSendSettled("Should I finish my CV first?")

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(DEFAULT_COACH_STREAM_REPLY)
    })

    expect(
      screen.queryByRole("button", { name: /good response|bad response/i })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: /speak|read aloud|share/i })
    ).not.toBeInTheDocument()
  })

  it("regenerates the latest Coach turn as a new row and keeps the prior one", async () => {
    scriptCoachStream({ texts: ["First answer"] })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Help me plan the week")
    expect(await screen.findByText("First answer")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
    })

    scriptCoachStream({ texts: ["Second answer"] })
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    expect(await screen.findByText("Second answer")).toBeInTheDocument()

    const thread = screen.getByRole("log", { name: "Thread" })
    expect(within(thread).getByText("First answer")).toBeInTheDocument()
    expect(within(thread).getByText("Second answer")).toBeInTheDocument()
    expect(within(thread).getAllByText("Help me plan the week")).toHaveLength(1)

    const regenerates = screen.getAllByRole("button", { name: "Regenerate" })
    expect(regenerates).toHaveLength(2)
    expect(regenerates[0]).toBeDisabled()
    expect(regenerates[1]).toBeEnabled()
  })

  it("keeps prior Command receipts when regenerating", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "Moved it." },
        {
          kind: "tool",
          name: "job_move",
          summary: "Moved 'Backend Intern' to Prep",
          ok: true,
          reversal: {
            possible: true,
            description:
              "Undo by moving the card back to its previous Stage and order.",
          },
        },
      ],
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Move the intern card to Prep")
    expect(
      await screen.findByRole("button", {
        name: stepButton("Moved 'Backend Intern' to Prep"),
      })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
    })

    scriptCoachStream({ texts: ["Here is another way to look at it."] })
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    expect(
      await screen.findByText("Here is another way to look at it.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: stepButton("Moved 'Backend Intern' to Prep"),
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Reversible — Undo by moving the card back to its previous Stage and order."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/reversed|undone|undo the previous/i)
    ).not.toBeInTheDocument()
  })

  it("shows a Retry alert when regenerate hits the daily cap", async () => {
    scriptCoachStream({ texts: ["First answer"] })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Cap me")
    expect(await screen.findByText("First answer")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
    })

    scriptCoachStream({
      httpError: {
        status: 429,
        code: "COACH_LIMIT_REACHED",
        message: "You've reached today's Coach turn limit",
      },
    })
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You've reached today's limit for this Coach mode"
    )
    expect(screen.getByText("First answer")).toBeInTheDocument()
    expect(
      within(screen.getByRole("log", { name: "Thread" })).getAllByText("Cap me")
    ).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("enables Regenerate only on the latest Coach message in a restored Thread", async () => {
    renderApp()
    await expectHomeIdle()
    await openStoredThread(new RegExp(FIXTURE_THREADS[0]!.title))
    await expectThreadText(FIXTURE_THREADS[0]!.messages[0]!.text)

    const thread = screen.getAllByRole("log", { name: "Thread" })[0]!
    const regenerates = within(thread).getAllByRole("button", {
      name: "Regenerate",
    })
    expect(regenerates).toHaveLength(2)
    expect(regenerates[0]).toBeDisabled()
    expect(regenerates[1]).toBeEnabled()
  })

  it("stops mid-stream, keeps what ran, and accepts a new send", async () => {
    const stream = scriptCoachStream({
      gated: true,
      texts: ["Partial reply", " should not appear"],
    })
    renderApp()
    await expectHomeIdle()

    await sendMessage("Stop me")
    stream.release(2)
    expect(await screen.findByText("Partial reply")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Stop" }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
    })
    expect(screen.getByText("Partial reply")).toBeInTheDocument()
    expect(screen.queryByText(/should not appear/)).not.toBeInTheDocument()

    scriptCoachStream({ texts: ["Next reply"] })
    await sendMessage("Try again")
    expect(await screen.findByText("Next reply")).toBeInTheDocument()
    expect(screen.getByText("Partial reply")).toBeInTheDocument()
    expect(screen.getByText("Try again")).toBeInTheDocument()
  })

  it("shows a failed bubble with Retry after a send error, then recovers", async () => {
    scriptCoachStream({
      httpError: {
        status: 503,
        code: "COACH_UNAVAILABLE",
        message: "The Coach is unavailable right now",
      },
    })
    renderApp()
    await expectHomeIdle()

    await sendMessage("Are you there?")
    const thread = await screen.findByRole("log", { name: "Thread" })
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Coach is unavailable right now. Try again in a moment."
    )
    expect(within(thread).getByText("Are you there?")).toBeInTheDocument()
    expect(
      within(thread)
        .getByText("Are you there?")
        .closest("[aria-invalid='true']")
    ).not.toBeNull()

    scriptCoachStream()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(
      await screen.findByText(DEFAULT_COACH_STREAM_REPLY)
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
    expect(
      within(screen.getByRole("log", { name: "Thread" })).getAllByText(
        "Are you there?"
      )
    ).toHaveLength(1)
  })
})
