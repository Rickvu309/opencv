import { act, screen, waitFor } from "@testing-library/react"
import { render as rtlRender } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { profileKey } from "@/lib/account-api.ts"
import { chatApiFetch } from "@/test/chat-api-mock.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { ChatStoreProvider } from "./chat-store.tsx"
import { CoachWorkspace } from "./coach-workspace.tsx"

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<object>()),
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    params,
    className,
    children,
  }: {
    to: string
    params?: { section?: string; docId?: string }
    className?: string
    children?: unknown
  }) => (
    <a
      href={
        params?.section
          ? `/settings/${params.section}`
          : params?.docId
            ? `/paper/${params.docId}`
            : to
      }
      className={className}
    >
      {children as never}
    </a>
  ),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

function installFetch(publicConfig: "ok" | "error" | "hang") {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path.includes("/api/public-config")) {
        if (publicConfig === "hang") return new Promise<Response>(() => {})
        if (publicConfig === "error") return new Response("no", { status: 500 })
      }
      return (
        (await chatApiFetch(input, init)) ??
        (await profileApiFetch(input, init)) ??
        new Response("{}", { status: 404 })
      )
    }
  )
}

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = rtlRender(
    <QueryClientProvider client={client}>
      <ChatStoreProvider>
        <CoachWorkspace />
      </ChatStoreProvider>
    </QueryClientProvider>
  )
  return { client, view }
}

describe("Coach configuration states", () => {
  it("shows a muted loading line while settings are still loading", async () => {
    installFetch("hang")
    const { view } = mount()
    const line = await screen.findByText("Loading Coach settings…")
    expect(line).toHaveAttribute("role", "status")
    expect(line.className).toContain("text-sm")
    expect(line.className).toContain("text-muted-foreground")
    view.unmount()
  })

  it("shows the settings error as an alert and retries from the same page", async () => {
    installFetch("error")
    const { view } = mount()
    const line = await screen.findByRole("alert")
    expect(line).toHaveTextContent(
      "Could not load Coach settings. Retry to reconnect."
    )
    expect(line.className).toContain("text-destructive")
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled()
    view.unmount()
  })

  it("opens Coach settings through the router when Coach is off", async () => {
    installFetch("ok")
    const { client, view } = mount()
    await waitFor(() =>
      expect(client.getQueryData(profileKey(""))).toBeTruthy()
    )
    act(() => {
      const profile = client.getQueryData(profileKey(""))
      client.setQueryData(profileKey(""), {
        ...(profile as Record<string, unknown>),
        agentChat: false,
      })
    })
    const link = await screen.findByRole("link", { name: "Open Settings" })
    expect(link).toHaveAttribute("href", "/settings/coach")
    expect(link.className).toContain("underline")
    expect(screen.getByRole("status")).toHaveTextContent("Coach is turned off.")
    view.unmount()
  })
})
