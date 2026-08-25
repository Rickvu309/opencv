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
import { getMockThreads } from "@/test/threads-api-mock.ts"
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
  it("sends into Thread mode with a thinking state, then keeps the user message", async () => {
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

    await expectSendSettled("Help me plan the week")
    expect(
      screen.queryByRole("button", { name: "Copy" })
    ).not.toBeInTheDocument()
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
