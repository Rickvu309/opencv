import { createElement, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"

import { HomePage } from "./home.tsx"

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  return render(createElement(HomePage), { wrapper })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("HomePage", () => {
  it("renders the OpenPath heading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true }))
    )
    renderHome()
    expect(
      screen.getByRole("heading", { level: 1, name: "OpenPath" })
    ).toBeInTheDocument()
  })

  it("reports the API as reachable once the live health endpoint answers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    renderHome()

    expect(await screen.findByText("API reachable")).toBeInTheDocument()
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:3001/health"
    )
  })

  it("reports the API as unreachable when the health endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    )

    renderHome()

    expect(await screen.findByText("API unreachable")).toBeInTheDocument()
  })

  it("reports the API as unreachable when health responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 502 }))
    )

    renderHome()

    expect(await screen.findByText("API unreachable")).toBeInTheDocument()
  })
})
