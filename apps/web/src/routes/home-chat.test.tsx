import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { HISTORY_PREVIEW_COUNT } from "@/features/home/threads.ts"
import { FIXTURE_THREADS } from "@/test/thread-fixtures.ts"
import {
  DEFAULT_COACH_STREAM_REPLY,
  getMockThreads,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

const idleHeading = new RegExp(
  `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
)

async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", { level: 1, name: idleHeading })
  ).toBeInTheDocument()
}

async function expectHistoryTitles() {
  const history = await screen.findByRole("navigation", { name: "History" })
  for (const thread of FIXTURE_THREADS.slice(0, HISTORY_PREVIEW_COUNT)) {
    expect(
      await within(history).findByRole("button", { name: thread.title })
    ).toBeInTheDocument()
  }
  return history
}

async function sendMessage(text: string) {
  const composer = await screen.findByRole("textbox", { name: "Message" })
  fireEvent.change(composer, { target: { value: text } })
  fireEvent.click(screen.getByRole("button", { name: "Send" }))
}

async function expectSendSettled(text: string) {
  expect(await screen.findByRole("log", { name: "Thread" })).toHaveTextContent(
    text
  )
  await waitFor(() => {
    expect(
      screen.queryByRole("status", { name: "Coach is working" })
    ).not.toBeInTheDocument()
  })
}

async function expectThreadText(text: string) {
  expect(await screen.findByRole("log", { name: "Thread" })).toBeInTheDocument()
  expect(await screen.findByText(text)).toBeInTheDocument()
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Home Thread mode and History", { timeout: 15_000 }, () => {
  it("streams a reply progressively and drops working status at first text", async () => {
    const stream = scriptCoachStream({
      gated: true,
      texts: ["Hello", " world"],
    })
    renderApp()
    await expectHomeIdle()

    await sendMessage("Help me plan the week")

    expect(
      screen.getByRole("status", { name: "Coach is working" })
    ).toBeInTheDocument()
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
      expect(
        screen.queryByRole("status", { name: "Coach is working" })
      ).not.toBeInTheDocument()
    })
    expect(screen.queryByText("Hello world")).not.toBeInTheDocument()

    stream.releaseAll()
    expect(await screen.findByText("Hello world")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
    })
    expect(screen.getByText("Worked for 1s")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Good response" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled()
  })

  it("renders a Command receipt with outcome and reversal, including after reload", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "Moved it." },
        {
          kind: "tool",
          name: "apply_moveCard",
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
      await screen.findByText("Ran apply.moveCard — Moved 'Backend Intern' to Prep")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("status", { name: "Command succeeded" })
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Move the intern card to Prep" })
    )
    expect(
      await screen.findByText("Ran apply.moveCard — Moved 'Backend Intern' to Prep")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Reversible — Undo by moving the card back to its previous Stage and order."
      )
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
    })
  })

  it("undoes a reversible receipt and appends a truthful new receipt", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "Moved it." },
        {
          kind: "tool",
          name: "apply_moveCard",
          summary: "Moved 'Backend Intern' to Prep",
          ok: true,
          reversal: {
            possible: true,
            command: "apply.moveCard",
            description:
              "Undo by moving the card back to its previous Stage and order.",
            input: {
              cardId: "11111111-1111-4111-8111-111111111111",
              stage: "inbox",
              beforeCardId: null,
            },
          },
        },
      ],
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Move the intern card to Prep")
    await expectSendSettled("Move the intern card to Prep")

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(
      await screen.findByText("Ran apply.moveCard — Undid the previous action")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("status", { name: "Command succeeded" })
    ).toHaveLength(2)
  })

  it("states a failed undo plainly and keeps the original undo", async () => {
    scriptCoachStream({
      undoFail: { summary: "Apply card not found" },
      parts: [
        {
          kind: "tool",
          name: "apply_moveCard",
          summary: "Moved 'Backend Intern' to Prep",
          ok: true,
          reversal: {
            possible: true,
            command: "apply.moveCard",
            description:
              "Undo by moving the card back to its previous Stage and order.",
            input: {
              cardId: "11111111-1111-4111-8111-111111111111",
              stage: "inbox",
            },
          },
        },
      ],
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Move a card that later vanished")
    await expectSendSettled("Move a card that later vanished")

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(
      await screen.findByText("Ran apply.moveCard — Apply card not found")
    ).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Command failed" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
  })

  it("keeps irreversible receipts as read-only notes", async () => {
    scriptCoachStream({
      parts: [
        {
          kind: "tool",
          name: "apply_listCards",
          summary: "Listed 2 Apply cards",
          ok: true,
          reversal: {
            possible: false,
            description: "This read does not change anything.",
          },
        },
      ],
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("What cards do I have?")
    expect(
      await screen.findByText("Ran apply.listCards — Listed 2 Apply cards")
    ).toBeInTheDocument()
    expect(
      screen.getByText("This read does not change anything.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Reversible —/)).not.toBeInTheDocument()
  })

  it("renders a failed Command receipt plainly", async () => {
    scriptCoachStream({
      parts: [
        {
          kind: "tool",
          name: "apply_moveCard",
          summary: "Apply card not found",
          ok: false,
        },
      ],
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Move a missing card")
    expect(
      await screen.findByText("Ran apply.moveCard — Apply card not found")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("status", { name: "Command failed" })
    ).toBeInTheDocument()
    expect(screen.queryByText(/Reversible —/)).not.toBeInTheDocument()
  })

  it("humanizes a failed apply.moveCard Zod dump and keeps it in the column", async () => {
    scriptCoachStream({
      parts: [
        {
          kind: "tool",
          name: "apply_moveCard",
          summary:
            'Invalid input for tool apply_moveCard: Type validation failed: Value: {"cardId":"00000000-0000-0000-0000-000000000002"}. Error message: [{"code":"invalid_format","pattern":"/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}$/","message":"Invalid UUID"}]',
          ok: false,
        },
      ],
    })
    renderApp()
    await expectHomeIdle()
    await sendMessage("Move card 00000000-0000-0000-0000-000000000002 to Prep")

    const receipt = await screen.findByRole("status", { name: "Command failed" })
    expect(receipt).toHaveTextContent("Ran apply.moveCard — That card id isn't valid")
    expect(receipt).not.toHaveTextContent(/Invalid input for tool|Type validation failed|Invalid UUID/)
    expect(receipt.textContent).not.toMatch(/[{}\[\]]/)
    expect(receipt.textContent).not.toMatch(/\/\^|\\d\{/)
    expect(receipt.className).toMatch(/min-w-0/)
    expect(receipt.querySelector("span")?.className).toMatch(/break-words/)
    expect(screen.queryByText(/Reversible —/)).not.toBeInTheDocument()
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
    expect(within(thread).getByText("Show me **markdown** please").tagName).toBe(
      "DIV"
    )
    expect(within(thread).getByText("Show me **markdown** please").closest("strong")).toBeNull()
  })

  it("copies reply text and records a thumbs rating with pressed state", async () => {
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

    const good = screen.getByRole("button", { name: "Good response" })
    expect(good).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(good)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Good response" })
      ).toHaveAttribute("aria-pressed", "true")
    })
    expect(
      getMockThreads()
        .flatMap((thread) => thread.messages)
        .some((message) => message.role === "coach" && message.rating === "up")
    ).toBe(true)
    expect(screen.getByRole("button", { name: "Bad response" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Copy link" })).toBeDisabled()
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
          name: "apply_moveCard",
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
      await screen.findByText("Ran apply.moveCard — Moved 'Backend Intern' to Prep")
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
      screen.getByText("Ran apply.moveCard — Moved 'Backend Intern' to Prep")
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
    fireEvent.click(
      await screen.findByRole("button", { name: FIXTURE_THREADS[0]!.title })
    )
    await expectThreadText(FIXTURE_THREADS[0]!.messages[0]!.text)

    const regenerates = screen.getAllByRole("button", { name: "Regenerate" })
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
    expect(thread.querySelector("[data-failed='true']")).not.toBeNull()

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

  it("confirms before deleting a Thread and does not run on dismiss", async () => {
    renderApp()
    await expectHomeIdle()
    const history = await expectHistoryTitles()
    const doomed = FIXTURE_THREADS[0]!

    const row = within(history)
      .getByRole("button", { name: doomed.title })
      .closest("div")
    expect(row).toBeTruthy()
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Delete Thread" }))

    const confirm = await screen.findByRole("dialog", { name: "Delete Thread" })
    expect(confirm).toHaveTextContent(doomed.title)
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }))
    expect(
      screen.queryByRole("dialog", { name: "Delete Thread" })
    ).not.toBeInTheDocument()
    expect(
      within(history).getByRole("button", { name: doomed.title })
    ).toBeInTheDocument()

    fireEvent.click(within(history).getByRole("button", { name: doomed.title }))
    expect(await screen.findByRole("log", { name: "Thread" })).toBeInTheDocument()
    const headerDelete = screen
      .getAllByRole("button", { name: "Delete Thread" })
      .find((button) => !history.contains(button))
    expect(headerDelete).toBeTruthy()
    fireEvent.click(headerDelete!)
    const confirmAgain = await screen.findByRole("dialog", {
      name: "Delete Thread",
    })
    fireEvent.click(within(confirmAgain).getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(
        within(screen.getByRole("navigation", { name: "History" })).queryByRole(
          "button",
          { name: doomed.title }
        )
      ).not.toBeInTheDocument()
    })
    await expectHomeIdle()
  })

  it("lists server Threads, restores one, and returns to idle on new Thread", async () => {
    renderApp()
    await expectHomeIdle()

    const history = await expectHistoryTitles()
    expect(
      within(history).queryByRole("button", {
        name: FIXTURE_THREADS[HISTORY_PREVIEW_COUNT]!.title,
      })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "See all" }))
    expect(
      within(history).getByRole("button", {
        name: FIXTURE_THREADS[HISTORY_PREVIEW_COUNT]!.title,
      })
    ).toBeInTheDocument()

    fireEvent.click(
      within(history).getByRole("button", { name: FIXTURE_THREADS[0]!.title })
    )

    expect(
      await screen.findByRole("log", { name: "Thread" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: idleHeading })
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(FIXTURE_THREADS[0]!.messages[0]!.text)
    ).toBeInTheDocument()
    expect(screen.getByRole("log", { name: "Thread" })).toHaveTextContent(
      FIXTURE_THREADS[0]!.messages[1]!.text
    )

    fireEvent.click(screen.getByRole("button", { name: "New Thread" }))
    await expectHomeIdle()
    expect(
      screen.queryByRole("log", { name: "Thread" })
    ).not.toBeInTheDocument()
  })

  it("adds a sent Thread to History and restores it after leaving Home", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    await sendMessage("Should I finish my CV first?")
    await expectSendSettled("Should I finish my CV first?")

    const history = screen.getByRole("navigation", { name: "History" })
    expect(
      await within(history).findByRole("button", {
        name: "Finish my CV first",
      })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectPaperDrive()
    expect(
      screen.getByRole("button", { name: "Finish my CV first" })
    ).toHaveAttribute("aria-current", "true")

    fireEvent.click(
      screen.getByRole("button", { name: "Finish my CV first" })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)
    })
    expect(screen.getByRole("log", { name: "Thread" })).toHaveTextContent(
      "Should I finish my CV first?"
    )
  })

  it("returns to idle Home from the Home nav item", async () => {
    renderApp()
    await expectHomeIdle()
    await expectHistoryTitles()

    fireEvent.click(
      screen.getByRole("button", { name: FIXTURE_THREADS[1]!.title })
    )
    await expectThreadText(FIXTURE_THREADS[1]!.messages[0]!.text)

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()
  })

  it("collapses and expands the History section", async () => {
    renderApp()
    await expectHomeIdle()
    await expectHistoryTitles()

    fireEvent.click(screen.getByRole("button", { name: "History" }))
    expect(
      screen.queryByRole("navigation", { name: "History" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "History" }))
    expect(
      screen.getByRole("navigation", { name: "History" })
    ).toBeInTheDocument()
  })

  it("replaces a first-line History title after the first Coach turn", async () => {
    renderApp()
    await expectHomeIdle()

    await sendMessage("Help me plan the week")
    await expectSendSettled("Help me plan the week")

    const history = screen.getByRole("navigation", { name: "History" })
    expect(
      await within(history).findByRole("button", { name: "Plan the week" })
    ).toBeInTheDocument()
    expect(
      within(history).queryByRole("button", { name: "Help me plan the week" })
    ).not.toBeInTheDocument()
    expect(
      getMockThreads().some((thread) => thread.title === "Plan the week")
    ).toBe(true)
  })

  it("leaves an existing History title alone when the User continues that Thread", async () => {
    renderApp()
    await expectHomeIdle()

    const existing = FIXTURE_THREADS[0]!
    fireEvent.click(
      await screen.findByRole("button", { name: existing.title })
    )
    await expectThreadText(existing.messages[0]!.text)

    await sendMessage("What should I do next?")
    await expectSendSettled("What should I do next?")

    expect(
      screen.getByRole("button", { name: existing.title })
    ).toBeInTheDocument()
    expect(
      getMockThreads().some((thread) => thread.id === existing.id && thread.title === existing.title)
    ).toBe(true)
  })

  it("keeps server Threads after remount and reopens them from History", async () => {
    const first = renderApp()
    await expectHomeIdle()
    await sendMessage("Keep this Thread")
    await expectSendSettled("Keep this Thread")
    expect(
      getMockThreads().some((thread) => thread.title === "Keep this Thread")
    ).toBe(true)
    first.unmount()

    renderApp()
    await expectHomeIdle()
    const history = await screen.findByRole("navigation", { name: "History" })
    expect(
      await within(history).findByRole("button", { name: "Keep this Thread" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: idleHeading })
    ).toBeInTheDocument()

    fireEvent.click(
      within(history).getByRole("button", { name: "Keep this Thread" })
    )
    await expectThreadText("Keep this Thread")
    expect(
      screen.queryByRole("heading", { name: idleHeading })
    ).not.toBeInTheDocument()
  })
})
