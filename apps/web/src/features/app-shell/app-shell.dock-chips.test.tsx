import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"
import "@/test/warm-routes.ts"
import { resetShellApiMock, setMockChats } from "@/test/shell-api-mock.ts"

beforeEach(() => {
  sessionStorage.clear()
  stubDesktopViewport(true)
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
  resetShellApiMock()
})

describe("dock chips", () => {
  it("drops the open chat from the dock while the panel shows it, and brings it back on close", async () => {
    setMockChats([
      {
        id: "chat-1",
        title: "Checkout notes",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ])
    renderApp(SURFACE_PATHS.pitch)
    fireEvent.click(
      await screen.findByRole("button", { name: "Checkout notes" })
    )
    expect(
      await screen.findByRole("button", { name: "Close" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Checkout notes" })
      ).toBeNull()
    })
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(
      await screen.findByRole("button", { name: "Checkout notes" })
    ).toBeInTheDocument()
  })

  it("shows no dock chips on the Coach page, where the recent list already names each chat", async () => {
    setMockChats([
      {
        id: "chat-1",
        title: "Checkout notes",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ])
    renderApp(SURFACE_PATHS.coach)
    const recent = await screen.findByRole("list", { name: "Recent chats" })
    expect(within(recent).getAllByRole("button")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Checkout notes" })).toBeNull()
  })
})
