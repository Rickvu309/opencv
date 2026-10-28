import { fireEvent, screen, waitFor, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@/test/render-with-client.tsx"
import { chatApiFetch } from "@/test/chat-api-mock.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { ChatStoreProvider } from "./chat-store.tsx"
import { CoachWorkspace } from "./coach-workspace.tsx"

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<object>()),
  useNavigate: () => vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      return (
        (await chatApiFetch(input, init)) ??
        (await profileApiFetch(input, init)) ??
        new Response("{}", { status: 404 })
      )
    }
  )
})

describe("Coach workspace", () => {
  it("marks one primary action only when the Coach page asks for it", async () => {
    const view = render(
      <ChatStoreProvider>
        <CoachWorkspace />
        <CoachWorkspace primaryAction />
      </ChatStoreProvider>
    )
    await screen.findAllByRole("button", { name: "Add" })
    expect(
      view.container.querySelectorAll("[data-primary-action]")
    ).toHaveLength(1)
    expect(
      screen
        .getAllByRole("button", { name: "Add" })
        .map((b) => b.hasAttribute("data-primary-action"))
    ).toEqual([false, true])
  })

  it("keeps New chat selected when the panel was opened with a saved chat", async () => {
    render(
      <ChatStoreProvider>
        <CoachWorkspace chatId="11111111-1111-4111-8111-111111111111" />
      </ChatStoreProvider>
    )
    await screen.findByText(
      "I don't know if I should chase internships or finish my CV first."
    )
    fireEvent.click(
      screen.getByRole("button", { name: "New chat", exact: true })
    )
    await screen.findByText("How can I help?")
    await waitFor(() =>
      expect(
        screen.queryByText(
          "I don't know if I should chase internships or finish my CV first."
        )
      ).not.toBeInTheDocument()
    )
    const composer = screen.getByPlaceholderText("Ask Coach anything")
    const moreIdeas = screen.getByRole("button", { name: "More ideas" })
    const starter = screen.getByRole("button", { name: "Review my CV" })
    expect(
      composer.compareDocumentPosition(moreIdeas) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      moreIdeas.compareDocumentPosition(starter) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    fireEvent.click(moreIdeas)
    expect(
      screen.getByRole("button", { name: "Follow up on an application" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Review my CV" })
    ).not.toBeInTheDocument()
  })

  it("disables sending and shows the reset and Upgrade when capped", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/api/coach/usage"))
          return Response.json({
            ok: true,
            data: {
              plan: "free",
              mode: "free",
              session: { capped: false, resetsAt: "2026-10-29T00:00:00Z" },
              day: {
                capped: true,
                used: 20,
                cap: 20,
                remaining: 0,
                resetsAt: "2026-10-29T00:00:00Z",
              },
              week: { capped: false, resetsAt: "2026-11-02T00:00:00Z" },
            },
          })
        return (
          (await chatApiFetch(input, init)) ??
          (await profileApiFetch(input, init)) ??
          new Response("{}", { status: 404 })
        )
      }
    )
    render(
      <ChatStoreProvider>
        <CoachWorkspace />
      </ChatStoreProvider>
    )
    await screen.findByRole("link", { name: "Upgrade" })
    expect(
      screen.getByRole("textbox", { name: "Message Coach" })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    expect(screen.getByRole("status")).toHaveTextContent("Coach is back at")
  })
})
