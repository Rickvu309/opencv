import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@/test/render-with-client.tsx"
import {
  chatApiFetch,
  scriptCoachStream,
  setMockChats,
} from "@/test/chat-api-mock.ts"
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
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

describe("Coach uses one full-page presentation", () => {
  it("uses the page header and composer when the compact panel expands", async () => {
    scriptCoachStream({})
    const { container, rerender } = render(
      <ChatStoreProvider>
        <CoachWorkspace presentation="compact" />
      </ChatStoreProvider>
    )
    const composer = await screen.findByRole("textbox", {
      name: "Message Coach",
    })
    expect(composer).not.toHaveFocus()
    const sizing = composer.className
    expect(
      container.querySelector('[data-slot="coach-panel-header"]')
    ).not.toBeNull()
    rerender(
      <ChatStoreProvider>
        <CoachWorkspace presentation="page" />
      </ChatStoreProvider>
    )
    expect(
      container.querySelector('[data-slot="coach-panel-header"]')
    ).toBeNull()
    expect(container.querySelector('[data-presentation="page"]')).not.toBeNull()
    expect(sizing).toContain("md:text-[14px]")
    const pageComposer = screen.getByRole("textbox", { name: "Message Coach" })
    expect(pageComposer.className).toContain("min-h-[68px]")
    expect(pageComposer.className).toContain("md:text-base")
    expect(pageComposer.closest("[data-stacked]")).toHaveAttribute(
      "data-stacked",
      "true"
    )
  })

  it("leaves the composer unfocused on a phone, including after a starter", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }))
    scriptCoachStream({})
    setMockChats([])
    render(
      <ChatStoreProvider>
        <CoachWorkspace />
      </ChatStoreProvider>
    )
    const composer = await screen.findByRole("textbox", {
      name: "Message Coach",
    })
    expect(composer).not.toHaveFocus()
    fireEvent.click(await screen.findByRole("button", { name: "Review my CV" }))
    expect(composer).toHaveValue("Review my CV")
    expect(composer).not.toHaveFocus()
  })
})
