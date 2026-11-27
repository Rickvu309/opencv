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
} from "@/test/chat-api-mock.ts"
import { FIXTURE_CHATS } from "@/test/chat-fixtures.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectCoachIdle,
  expectSendSettled,
  expectChatText,
  idleHeading,
  sendMessage,
  stepName,
} from "@/test/coach-chat-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openStoredChat(title: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: "Search" }))
  const dialog = await screen.findByRole("dialog", { name: "Search" })
  fireEvent.click(await within(dialog).findByRole("button", { name: title }))
}

describe("Coach chat and history", { timeout: 15_000 }, () => {
  it("streams a reply progressively and drops working status at first text", async () => {
    const stream = scriptCoachStream({
      gated: true,
      texts: ["Hello", " world"],
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    await sendMessage("Help me plan the week")

    const working = within(screen.getByRole("log", { name: "Chat" })).getByRole(
      "status"
    )
    expect(working).toHaveTextContent(/^Working$/)
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Send" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("log", { name: "Chat" })).toHaveTextContent(
      "Help me plan the week"
    )
    expect(
      screen.queryByRole("heading", { name: idleHeading })
    ).not.toBeInTheDocument()

    stream.release(2)
    expect(await screen.findByText("Hello")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
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
          name: "job.move",
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
    const first = renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Move the intern card to Prep")
    await expectSendSettled("Move the intern card to Prep")
    expect(
      await screen.findByRole("heading", {
        name: stepName("Moved 'Backend Intern' to Prep"),
      })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Done")[0]).toBeVisible()
    expect(
      screen.getByText(
        "Reversible: Undo by moving the card back to its previous Stage and order."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
    first.unmount()

    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await openStoredChat(/Move the intern card to Prep/)
    expect(
      (
        await screen.findAllByRole("heading", {
          name: stepName("Moved 'Backend Intern' to Prep"),
        })
      )[0]
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(
        "Reversible: Undo by moving the card back to its previous Stage and order."
      ).length
    ).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Undo" })[0]).toBeEnabled()
    })
  })

  it("renders the three rich receipt types in the Chat", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "I made those changes." },
        {
          kind: "tool",
          name: "paper.edit",
          summary: "Updated content of PM track CV",
          ok: true,
          reversal: {
            possible: true,
            description: "Undo by writing the previous content back.",
          },
          detail: {
            type: "paper.replace",
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
          name: "job.move",
          summary: "Moved Associate PM intern at Local startup to Prep",
          ok: true,
          reversal: {
            possible: true,
            description: "Undo by moving the card back.",
            command: "job.move",
            input: { cardId: "c1", stage: "inbox" },
          },
          detail: {
            type: "job.move",
            title: "Associate PM intern",
            company: "Local startup",
            from: "inbox",
            to: "prep",
          },
        },
        {
          kind: "tool",
          name: "paper.create",
          summary: "Created CV Untitled CV",
          ok: true,
          reversal: {
            possible: true,
            description: "Undo by deleting the Paper doc.",
          },
          detail: {
            type: "paper.create",
            docKind: "cv",
            name: "Untitled CV",
            status: "draft",
          },
        },
      ],
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Update my CV, move the card, and start a new CV")
    await expectSendSettled("Update my CV, move the card, and start a new CV")

    expect(screen.getByText("PM track CV")).toBeInTheDocument()

    expect(screen.getByText("1 change applied")).toBeInTheDocument()
    expect(screen.getByText("New summary")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Moved Associate PM intern at Local startup from inbox to prep"
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText("inbox to prep")).toBeInTheDocument()
    expect(screen.getByText("Created Untitled CV")).toBeInTheDocument()
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
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Show me **markdown** please")

    const chat = await screen.findByRole("log", { name: "Chat" })
    expect(await screen.findByText("star")).toBeInTheDocument()
    expect(chat.querySelector("strong")?.textContent).toBe("star")
    expect(chat.querySelector("code")?.textContent).toBe("Prep")
    expect(screen.getByRole("list")).toBeInTheDocument()
    expect(within(chat).getByText("Show me **markdown** please").tagName).toBe(
      "DIV"
    )
    expect(
      within(chat).getByText("Show me **markdown** please").closest("strong")
    ).toBeNull()
  })

  it("copies reply text and offers no rating buttons", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
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

  it("regenerates the latest Coach turn with one current answer", async () => {
    scriptCoachStream({ texts: ["First answer"] })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Help me plan the week")
    expect(await screen.findByText("First answer")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
    })

    scriptCoachStream({ texts: ["Second answer"] })
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    expect(await screen.findByText("Second answer")).toBeInTheDocument()

    const chat = screen.getByRole("log", { name: "Chat" })
    expect(within(chat).queryByText("First answer")).not.toBeInTheDocument()
    expect(within(chat).getByText("Second answer")).toBeInTheDocument()
    expect(within(chat).getAllByText("Help me plan the week")).toHaveLength(1)

    const regenerates = screen.getAllByRole("button", { name: "Regenerate" })
    expect(regenerates).toHaveLength(1)
    expect(regenerates[0]).toBeEnabled()
  })

  it("keeps prior Command receipts when regenerating", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "Moved it." },
        {
          kind: "tool",
          name: "job.move",
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
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Move the intern card to Prep")
    expect(
      await screen.findByRole("heading", {
        name: stepName("Moved 'Backend Intern' to Prep"),
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
      screen.getByRole("heading", {
        name: stepName("Moved 'Backend Intern' to Prep"),
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Reversible: Undo by moving the card back to its previous Stage and order."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/reversed|undone|undo the previous/i)
    ).not.toBeInTheDocument()
  })

  it("shows a Retry alert when regenerate hits the daily cap", async () => {
    scriptCoachStream({ texts: ["First answer"] })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
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
      within(screen.getByRole("log", { name: "Chat" })).getAllByText("Cap me")
    ).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("enables Regenerate only on the latest Coach message in a restored Chat", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await openStoredChat(new RegExp(FIXTURE_CHATS[0]!.title))
    await expectChatText(FIXTURE_CHATS[0]!.messages[0]!.text)

    const chat = screen.getAllByRole("log", { name: "Chat" })[0]!
    const regenerates = within(chat).getAllByRole("button", {
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
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

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

  it.each([false, true])(
    "shows safe copy and recovers after a streamed error with omitEnd=%s",
    async (omitEnd) => {
      const rawError = "Provider failed: private upstream diagnostics"
      scriptCoachStream({
        texts: ["Partial answer"],
        streamError: rawError,
        omitEnd,
      })
      renderApp(SURFACE_PATHS.coach)
      await expectCoachIdle()
      await sendMessage("Help me prepare")

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Something went wrong sending that. Try again."
      )
      expect(screen.queryByText(rawError)).not.toBeInTheDocument()
      expect(screen.getByText("Partial answer")).toBeInTheDocument()

      scriptCoachStream({ texts: ["Recovered answer"] })
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
      expect(await screen.findByText("Recovered answer")).toBeInTheDocument()
      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      })
    }
  )

  it("shows the limit sentence when a live reply is cut off", async () => {
    scriptCoachStream({
      texts: ["Here is half"],
      streamError: "The Coach hit its limit for this turn.",
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Help me prepare")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Coach hit its limit for this turn."
    )
    expect(
      screen.queryByText("Something went wrong sending that. Try again.")
    ).not.toBeInTheDocument()
  })

  it("shows a failed bubble with Retry after a send error, then recovers", async () => {
    scriptCoachStream({
      httpError: {
        status: 503,
        code: "COACH_UNAVAILABLE",
        message: "The Coach is unavailable right now",
      },
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    await sendMessage("Are you there?")
    const chat = await screen.findByRole("log", { name: "Chat" })
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Coach is unavailable right now. Try again in a moment."
    )
    expect(within(chat).getByText("Are you there?")).toBeInTheDocument()
    expect(
      within(chat).getByText("Are you there?").closest("[aria-invalid='true']")
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
      within(screen.getByRole("log", { name: "Chat" })).getAllByText(
        "Are you there?"
      )
    ).toHaveLength(1)
  })
})
