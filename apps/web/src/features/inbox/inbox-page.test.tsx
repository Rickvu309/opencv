import { QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "@/lib/query-client.ts"
import { jsonOk, pathOf } from "@/test/mock-http.ts"
import {
  INBOX_THREADS,
  LOCAL_DETAIL,
  REGIONAL_DETAIL,
} from "@/test/inbox-fixtures.ts"

import { InboxPage } from "./inbox-page.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <InboxPage />
    </QueryClientProvider>
  )
}

describe("inbox page", () => {
  it("skips without scanning and then offers Scan", async () => {
    let skipped = false
    const posts: string[] = []
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = pathOf(input)
        const method = init?.method ?? "GET"
        if (method === "POST") posts.push(path)
        if (path === "/api/commands/inbox.skip") skipped = true
        if (path === "/api/inbox/connect") return jsonOk({ url: null })
        if (path === "/api/inbox") {
          return jsonOk({
            connected: false,
            skipped,
            threads: [],
          })
        }
        return jsonOk({})
      }
    )
    renderPage()
    expect(
      await screen.findByRole("heading", { level: 1, name: "Inbox" })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Never miss a recruiter reply",
      })
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }))
    expect(await screen.findByText("No job emails yet")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Messages" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Connect Gmail" })).toBeNull()
    expect(posts).toEqual(["/api/commands/inbox.skip"])
  })

  it("opens a row into the reader with Back to inbox when narrow", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
    }))
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = pathOf(input)
      if (path === "/api/inbox") {
        return jsonOk({
          connected: false,
          skipped: true,
          threads: INBOX_THREADS,
        })
      }
      if (path.startsWith("/api/inbox/")) return jsonOk(LOCAL_DETAIL)
      return jsonOk({ timeZone: "Asia/Ho_Chi_Minh" })
    })
    renderPage()
    const row = await screen.findByRole("button", {
      name: /Associate PM, Local startup/,
    })
    expect(screen.queryByRole("button", { name: "Back to inbox" })).toBeNull()
    await userEvent.click(row)
    expect(
      await screen.findByRole("button", { name: "Back to inbox" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Associate PM, Local startup/ })
      ).toBeNull()
    })
  })

  it("uses the profile zone from the inbox list for chips and snooze", async () => {
    const posts: { path: string; input: unknown }[] = []
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = pathOf(input)
        const method = init?.method ?? "GET"
        if (method === "POST") {
          const body = init?.body ? JSON.parse(String(init.body)) : null
          posts.push({ path, input: body?.input })
        }
        if (path === "/api/inbox") {
          return jsonOk({
            connected: false,
            skipped: true,
            timeZone: "Asia/Singapore",
            threads: [INBOX_THREADS[0]],
          })
        }
        if (path.startsWith("/api/inbox/")) return jsonOk(REGIONAL_DETAIL)
        return jsonOk({})
      }
    )
    renderPage()
    expect(
      await screen.findByRole("button", { name: "Thu 15:30" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Thu 16:00" })
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Snooze" }))
    const until = posts.find(
      (post) => post.path === "/api/commands/inbox.snooze"
    )?.input as { until?: string } | undefined
    expect(until?.until?.endsWith("T23:00:00.000Z")).toBe(true)
  })
})
