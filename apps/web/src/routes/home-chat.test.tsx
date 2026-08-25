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

describe("Home Thread mode and History", () => {
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
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDisabled()
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
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Copy link" })).toBeDisabled()
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
        name: "Should I finish my CV first?",
      })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectPaperDrive()
    expect(
      screen.getByRole("button", { name: "Should I finish my CV first?" })
    ).toHaveAttribute("aria-current", "true")

    fireEvent.click(
      screen.getByRole("button", { name: "Should I finish my CV first?" })
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
