import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { HISTORY_PREVIEW_COUNT } from "@/features/home/threads.ts"
import { FIXTURE_THREADS } from "@/test/thread-fixtures.ts"
import { getMockThreads } from "@/test/threads-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectHistoryTitles,
  expectHomeIdle,
  expectSendSettled,
  expectThreadText,
  idleHeading,
  sendMessage,
} from "@/test/home-chat-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Home History", { timeout: 15_000 }, () => {
  it("confirms before deleting a Thread and does not run on dismiss", async () => {
    renderApp()
    await expectHomeIdle()
    const history = await expectHistoryTitles()
    const doomed = FIXTURE_THREADS[0]!

    const row = within(history)
      .getByRole("button", { name: doomed.title })
      .closest("div")
    expect(row).toBeTruthy()
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Delete Thread" })
    )

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
    expect(
      await screen.findByRole("log", { name: "Thread" })
    ).toBeInTheDocument()
    const headerDelete = screen
      .getAllByRole("button", { name: "Delete Thread" })
      .find((button) => !history.contains(button))
    expect(headerDelete).toBeTruthy()
    fireEvent.click(headerDelete!)
    const confirmAgain = await screen.findByRole("dialog", {
      name: "Delete Thread",
    })
    fireEvent.click(
      within(confirmAgain).getByRole("button", { name: "Delete" })
    )

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

    fireEvent.click(screen.getByRole("button", { name: "Finish my CV first" }))
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
    fireEvent.click(await screen.findByRole("button", { name: existing.title }))
    await expectThreadText(existing.messages[0]!.text)

    await sendMessage("What should I do next?")
    await expectSendSettled("What should I do next?")

    expect(
      screen.getByRole("button", { name: existing.title })
    ).toBeInTheDocument()
    expect(
      getMockThreads().some(
        (thread) => thread.id === existing.id && thread.title === existing.title
      )
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
