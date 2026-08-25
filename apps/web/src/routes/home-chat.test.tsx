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
import {
  HISTORY_PREVIEW_COUNT,
  SEED_THREADS,
  STUB_COACH_REPLY,
} from "@/features/home/threads.ts"
import { renderApp } from "@/test/render-app.tsx"

const idleHeading = new RegExp(
  `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
)

async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", { level: 1, name: idleHeading })
  ).toBeInTheDocument()
}

async function sendMessage(text: string) {
  const composer = await screen.findByRole("textbox", { name: "Message" })
  fireEvent.change(composer, { target: { value: text } })
  fireEvent.click(screen.getByRole("button", { name: "Send" }))
}

async function expectStubReply() {
  expect(
    await screen.findByText(STUB_COACH_REPLY, {}, { timeout: 2000 })
  ).toBeInTheDocument()
}

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe("Home Thread mode and History", () => {
  it("sends into Thread mode with a thinking state, then an honest stub reply", async () => {
    renderApp()
    await expectHomeIdle()

    await sendMessage("Help me plan the week")

    expect(
      screen.getByRole("status", { name: "Coach is working" })
    ).toBeInTheDocument()
    expect(screen.getByRole("log", { name: "Thread" })).toHaveTextContent(
      "Help me plan the week"
    )
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: idleHeading })
    ).not.toBeInTheDocument()

    await expectStubReply()
    expect(
      screen.queryByRole("status", { name: "Coach is working" })
    ).not.toBeInTheDocument()
    expect(screen.getByText(STUB_COACH_REPLY)).toHaveTextContent(
      /haven't edited Paper or Apply/i
    )
    expect(screen.getByText(STUB_COACH_REPLY)).toHaveTextContent(
      /haven't run any Commands/i
    )
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDisabled()
  })

  it("lists seed Threads, restores one, and returns to idle on new Thread", async () => {
    renderApp()
    await expectHomeIdle()

    const history = screen.getByRole("navigation", { name: "History" })
    for (const thread of SEED_THREADS.slice(0, HISTORY_PREVIEW_COUNT)) {
      expect(
        within(history).getByRole("button", { name: thread.title })
      ).toBeInTheDocument()
    }
    expect(
      within(history).queryByRole("button", {
        name: SEED_THREADS[HISTORY_PREVIEW_COUNT]!.title,
      })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "See all" }))
    expect(
      within(history).getByRole("button", {
        name: SEED_THREADS[HISTORY_PREVIEW_COUNT]!.title,
      })
    ).toBeInTheDocument()

    fireEvent.click(
      within(history).getByRole("button", { name: SEED_THREADS[0]!.title })
    )

    expect(
      screen.queryByRole("heading", { name: idleHeading })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("log", { name: "Thread" })).toHaveTextContent(
      SEED_THREADS[0]!.messages[0]!.text
    )
    expect(screen.getByRole("log", { name: "Thread" })).toHaveTextContent(
      SEED_THREADS[0]!.messages[1]!.text
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
    await expectStubReply()

    const history = screen.getByRole("navigation", { name: "History" })
    expect(
      within(history).getByRole("button", {
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
    expect(screen.getByText(STUB_COACH_REPLY)).toBeInTheDocument()
  })

  it("returns to idle Home from the Home nav item", async () => {
    renderApp()
    await expectHomeIdle()

    fireEvent.click(
      screen.getByRole("button", { name: SEED_THREADS[1]!.title })
    )
    expect(screen.getByRole("log", { name: "Thread" })).toHaveTextContent(
      SEED_THREADS[1]!.messages[0]!.text
    )

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()
  })

  it("collapses and expands the History section", async () => {
    renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "History" }))
    expect(
      screen.queryByRole("navigation", { name: "History" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "History" }))
    expect(
      screen.getByRole("navigation", { name: "History" })
    ).toBeInTheDocument()
  })

  it("restores the active Thread from sessionStorage", async () => {
    const first = renderApp()
    await expectHomeIdle()
    await sendMessage("Keep this Thread")
    await expectStubReply()
    first.unmount()

    renderApp()
    expect(
      await screen.findByRole("log", { name: "Thread" })
    ).toHaveTextContent("Keep this Thread")
    expect(screen.getByText(STUB_COACH_REPLY)).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: idleHeading })
    ).not.toBeInTheDocument()
  })
})
