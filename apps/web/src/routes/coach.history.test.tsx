import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { renderApp } from "@/test/render-app.tsx"
import { chatCreateCalls, setMockChats } from "@/test/shell-api-mock.ts"

const CHAT_ID = "11111111-1111-4111-8111-111111111111"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("coach history", () => {
  it("groups today, filters search, opens a chat, and starts one with Ctrl N", async () => {
    setMockChats([
      {
        id: CHAT_ID,
        title: "CV vs internship first",
        focusKind: null,
        focusId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Old notes",
        focusKind: null,
        focusId: null,
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
    ])
    const { router } = renderApp("/app/coach")
    fireEvent.click(await screen.findByRole("button", { name: "Chat history" }))
    const history = await screen.findByRole("region", { name: "Chats" })
    expect(
      await within(history).findByRole("heading", { name: "Today" })
    ).toBeInTheDocument()
    expect(
      within(history).getByRole("button", { name: "CV vs internship first" })
    ).toBeInTheDocument()
    expect(
      within(history).queryByRole("button", { name: "Old notes" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Older" })
    ).not.toBeInTheDocument()

    fireEvent.change(
      within(history).getByRole("textbox", { name: "Search chats" }),
      {
        target: { value: "internship" },
      }
    )
    expect(
      await within(history).findByRole("button", {
        name: "CV vs internship first",
      })
    ).toBeInTheDocument()
    fireEvent.change(
      within(history).getByRole("textbox", { name: "Search chats" }),
      {
        target: { value: "zzzz-none" },
      }
    )
    expect(await within(history).findByText("No chats yet")).toBeInTheDocument()

    fireEvent.change(
      within(history).getByRole("textbox", { name: "Search chats" }),
      {
        target: { value: "" },
      }
    )
    fireEvent.click(
      await within(history).findByRole("button", {
        name: "CV vs internship first",
      })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/app/coach/${CHAT_ID}`)
    })
    expect(
      await screen.findByText(
        "I don't know if I should chase internships or finish my CV first."
      )
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "n", ctrlKey: true })
    await waitFor(() => {
      expect(chatCreateCalls().length).toBeGreaterThan(0)
    })
  })

  it("groups Yesterday and Last 7 days from a fixed zone", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-27T18:00:00.000Z"))
    setMockChats([
      {
        id: "33333333-3333-4333-8333-333333333331",
        title: "Yesterday note",
        focusKind: null,
        focusId: null,
        createdAt: "2026-10-27T02:00:00.000Z",
        updatedAt: "2026-10-27T02:00:00.000Z",
      },
      {
        id: "33333333-3333-4333-8333-333333333332",
        title: "Earlier note",
        focusKind: null,
        focusId: null,
        createdAt: "2026-10-25T02:00:00.000Z",
        updatedAt: "2026-10-25T02:00:00.000Z",
      },
    ])
    renderApp("/app/coach")
    fireEvent.click(await screen.findByRole("button", { name: "Chat history" }))
    const history = await screen.findByRole("region", { name: "Chats" })
    expect(
      await within(history).findByRole("heading", { name: "Yesterday" })
    ).toBeInTheDocument()
    expect(
      within(history).getByRole("button", { name: "Yesterday note" })
    ).toBeInTheDocument()
    expect(
      within(history).getByRole("heading", { name: "Last 7 days" })
    ).toBeInTheDocument()
    expect(
      within(history).getByRole("button", { name: "Earlier note" })
    ).toBeInTheDocument()
  })
})
