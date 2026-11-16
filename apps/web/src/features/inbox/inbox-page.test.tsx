import { QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "@/lib/query-client.ts"
import { jsonError, jsonOk, pathOf } from "@/test/mock-http.ts"
import {
  INBOX_THREADS,
  LOCAL_DETAIL,
  REGIONAL_DETAIL,
} from "@/test/inbox-fixtures.ts"

import { InboxPage } from "./inbox-page.tsx"
import { GMAIL_UNAVAILABLE_COPY } from "./inbox-parts.tsx"

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
  it("skips without scanning and then offers an example inbox", async () => {
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
    expect(screen.getByText(GMAIL_UNAVAILABLE_COPY)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "View example inbox" })
    ).toHaveAttribute("data-variant", "outline")
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Inbox" })
    ).toHaveLength(1)
    expect(screen.getByRole("region", { name: "Messages" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Connect Gmail" })).toBeNull()
    expect(posts).toEqual(["/api/commands/inbox.skip"])
  })

  it("shows example mail from View example inbox when Gmail cannot connect", async () => {
    let scanned = false
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = pathOf(input)
        if (path === "/api/inbox/connect") return jsonOk({ url: null })
        if (path === "/api/commands/inbox.scan") {
          scanned = true
          return jsonOk({
            threads: INBOX_THREADS.slice(0, 1),
            emailCount: 1,
            companyCount: 1,
          })
        }
        if (path === "/api/inbox") {
          return jsonOk({
            connected: false,
            skipped: true,
            threads: scanned ? INBOX_THREADS.slice(0, 1) : [],
          })
        }
        if ((init?.method ?? "GET") === "POST") return jsonOk({})
        return jsonOk({})
      }
    )
    renderPage()
    await userEvent.click(
      await screen.findByRole("button", { name: "View example inbox" })
    )
    const banner = await screen.findByRole("status")
    expect(banner).toHaveTextContent(GMAIL_UNAVAILABLE_COPY)
    const pane = document.querySelector('[data-pen-section="List pane"]')
    expect(pane?.contains(banner)).toBe(true)
    const header = pane?.querySelector("header")
    expect(
      header &&
        header.compareDocumentPosition(banner) &
          Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      screen.getByRole("button", {
        name: /Business Analyst, Regional bank/,
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Finding your job emails")
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Inbox" })
    ).toHaveLength(1)
  })

  it("opens no thread on desktop until a row is picked", async () => {
    const paths: string[] = []
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = pathOf(input)
      paths.push(path)
      if (path === "/api/inbox") {
        return jsonOk({
          connected: false,
          skipped: true,
          timeZone: "Asia/Ho_Chi_Minh",
          threads: INBOX_THREADS,
        })
      }
      return jsonOk(REGIONAL_DETAIL)
    })
    renderPage()
    expect(await screen.findByText("4 unread")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Snooze" })).toBeNull()
    expect(paths.filter((path) => path.startsWith("/api/inbox/"))).toEqual([])
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

  it("closes a narrow reader when snooze removes its thread from the inbox", async () => {
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
    let snoozed = false
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = pathOf(input)
      if (path === "/api/inbox") {
        return jsonOk({
          connected: false,
          skipped: true,
          threads: snoozed
            ? INBOX_THREADS.slice(0, 2).filter(
                (thread) => thread.id !== LOCAL_DETAIL.id
              )
            : INBOX_THREADS.slice(0, 2),
        })
      }
      if (path === "/api/commands/inbox.snooze") snoozed = true
      if (path.startsWith("/api/inbox/")) {
        return path.endsWith(LOCAL_DETAIL.id)
          ? jsonOk(LOCAL_DETAIL)
          : jsonOk(REGIONAL_DETAIL)
      }
      return jsonOk({})
    })
    renderPage()
    await userEvent.click(
      await screen.findByRole("button", {
        name: /Associate PM, Local startup/,
      })
    )
    await userEvent.click(await screen.findByRole("button", { name: "Snooze" }))
    expect(
      await screen.findByRole("button", {
        name: /Business Analyst, Regional bank/,
      })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Back to inbox" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Snooze" })).toBeNull()
    await userEvent.click(
      screen.getByRole("button", { name: /Business Analyst, Regional bank/ })
    )
    expect(
      await screen.findByRole("button", { name: "Snooze" })
    ).toBeInTheDocument()
    expect(screen.getByText("1 of 1")).toBeInTheDocument()
  })

  it("lists snoozed mail and reopens a thread in the inbox early", async () => {
    let snoozed = true
    const posts: { path: string; input: unknown }[] = []
    const snoozedDetail = { ...LOCAL_DETAIL, status: "snoozed" as const }
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = pathOf(input)
        if ((init?.method ?? "GET") === "POST") {
          const body = init?.body ? JSON.parse(String(init.body)) : null
          posts.push({ path, input: body?.input })
          if (path === "/api/commands/inbox.snooze") snoozed = false
          return jsonOk({ activityId: "00000000-0000-4000-8000-000000000099" })
        }
        if (path === "/api/inbox") {
          return jsonOk({
            connected: false,
            skipped: true,
            threads: snoozed ? [] : [LOCAL_DETAIL],
          })
        }
        if (path === "/api/inbox/snoozed") {
          return jsonOk({
            connected: false,
            skipped: true,
            threads: snoozed ? [snoozedDetail] : [],
          })
        }
        if (path.startsWith("/api/inbox/")) {
          return jsonOk(snoozed ? snoozedDetail : LOCAL_DETAIL)
        }
        return jsonOk({})
      }
    )
    renderPage()
    await userEvent.click(
      await screen.findByRole("button", { name: "Snoozed" })
    )
    await userEvent.click(
      await screen.findByRole("button", {
        name: /Associate PM, Local startup/,
      })
    )
    expect(
      await screen.findByRole("button", { name: "Return to inbox" })
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "Return to inbox" })
    )
    await screen.findByRole("button", {
      name: /Associate PM, Local startup/,
    })
    expect(posts).toContainEqual({
      path: "/api/commands/inbox.snooze",
      input: { threadId: LOCAL_DETAIL.id, until: null },
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
    await userEvent.click(
      await screen.findByRole("button", {
        name: /Business Analyst, Regional bank/,
      })
    )
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

  it("refetches the list and the open thread after a command, through the contract", async () => {
    const reads: string[] = []
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = pathOf(input)
        if ((init?.method ?? "GET") === "GET") reads.push(path)
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
    await userEvent.click(
      await screen.findByRole("button", {
        name: /Business Analyst, Regional bank/,
      })
    )
    await screen.findByRole("button", { name: "Snooze" })
    const threadPath = `/api/inbox/${REGIONAL_DETAIL.id}`
    const count = (path: string) => reads.filter((read) => read === path).length
    expect(count("/api/inbox")).toBe(1)
    expect(count(threadPath)).toBe(1)
    await userEvent.click(screen.getByRole("button", { name: "Snooze" }))
    await waitFor(() => {
      expect(count("/api/inbox")).toBe(2)
      expect(count(threadPath)).toBe(2)
    })
  })

  it("keeps Scan when a connected inbox is empty", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      if (pathOf(input) === "/api/inbox") {
        return jsonOk({ connected: true, skipped: false, threads: [] })
      }
      return jsonOk({})
    })
    renderPage()
    const scan = await screen.findByRole("button", { name: "Scan" })
    expect(scan).toHaveAttribute("data-variant", "ghost")
    expect(screen.queryByText(GMAIL_UNAVAILABLE_COPY)).toBeNull()
  })

  it("announces loading as a notice", async () => {
    let release: (value: Response) => void = () => {}
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      if (pathOf(input) === "/api/inbox") {
        return new Promise<Response>((resolve) => {
          release = resolve
        })
      }
      return Promise.resolve(jsonOk({}))
    })
    renderPage()
    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent("Loading inbox.")
    expect(status.className).toContain("bg-muted/50")
    release(jsonOk({ connected: true, skipped: true, threads: [] }))
    expect(await screen.findByText("No job emails yet")).toBeInTheDocument()
  })

  it("refreshes a list that failed to load", async () => {
    let fail = true
    let reads = 0
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = pathOf(input)
      if (path === "/api/inbox") {
        reads += 1
        if (fail) return jsonError(500, "INTERNAL", "no")
        return jsonOk({ connected: true, skipped: true, threads: [] })
      }
      return jsonOk({})
    })
    renderPage()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load inbox.")
    expect(alert.className).toContain("bg-muted/50")
    fail = false
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(await screen.findByText("No job emails yet")).toBeInTheDocument()
    expect(reads).toBeGreaterThan(1)
  })

  it("refreshes a message that failed to load", async () => {
    let fail = true
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = pathOf(input)
      if (path === "/api/inbox") {
        return jsonOk({
          connected: true,
          skipped: true,
          threads: [INBOX_THREADS[0]],
        })
      }
      if (path.startsWith("/api/inbox/")) {
        if (fail) return jsonError(500, "INTERNAL", "no")
        return jsonOk(REGIONAL_DETAIL)
      }
      return jsonOk({})
    })
    renderPage()
    await userEvent.click(
      await screen.findByRole("button", {
        name: /Business Analyst, Regional bank/,
      })
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load this email."
    )
    fail = false
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(
      await screen.findByRole("button", { name: "Snooze" })
    ).toBeInTheDocument()
  })

  it("refreshes snoozed mail that failed to load", async () => {
    let fail = true
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = pathOf(input)
      if (path === "/api/inbox") {
        return jsonOk({
          connected: true,
          skipped: true,
          threads: [INBOX_THREADS[0]],
        })
      }
      if (path === "/api/inbox/snoozed") {
        if (fail) return jsonError(500, "INTERNAL", "no")
        return jsonOk({ connected: true, skipped: true, threads: [] })
      }
      return jsonOk({})
    })
    renderPage()
    await userEvent.click(
      await screen.findByRole("button", { name: "Snoozed" })
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load snoozed emails."
    )
    fail = false
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull()
    })
    expect(screen.getByText("No snoozed emails.")).toBeInTheDocument()
  })
})
