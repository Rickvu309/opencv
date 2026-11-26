import { cleanup, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { chatApiFetch } from "@/test/chat-api-mock.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { render } from "@/test/render-with-client.tsx"

import { ChatStoreProvider } from "./chat-store.tsx"
import { CoachContextAttachments } from "./coach-context-attachments.tsx"
import { CoachWorkspace } from "./coach-workspace.tsx"
import { ReceiptDetail } from "./rich-receipts.tsx"

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<object>()),
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    params,
    className,
    children,
  }: {
    to?: string
    params?: { section?: string; docId?: string; jobId?: string }
    className?: string
    children?: unknown
  }) => (
    <a
      data-router-link=""
      data-to={to ?? ""}
      href={
        params?.docId
          ? `/paper/${params.docId}`
          : params?.jobId
            ? `/apply/${params.jobId}`
            : params?.section
              ? `/settings/${params.section}`
              : (to ?? "")
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
})

function emptyLists() {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname
      if (path === "/api/reads/paper.list" || path === "/api/reads/job.list")
        return Response.json({ ok: true, data: [] })
      return (
        (await chatApiFetch(input, init)) ??
        (await profileApiFetch(input, init)) ??
        new Response("{}", { status: 404 })
      )
    }
  )
}

describe("Coach internal links", () => {
  it("opens Paper and Job context chips through the router and external context in a new tab", () => {
    render(
      <CoachContextAttachments
        attachments={[
          { kind: "paper", id: "p1", label: "My CV" },
          { kind: "job", id: "j1", label: "Analyst at Acme" },
          {
            kind: "link",
            id: "https://example.com/careers",
            label: "example.com/careers",
          },
        ]}
        onRemove={vi.fn()}
      />
    )
    for (const [name, to, href] of [
      ["My CV", "/paper/$docId", "/paper/p1"],
      ["Analyst at Acme", "/apply/$jobId", "/apply/j1"],
    ]) {
      const link = screen.getByRole("link", { name })
      expect(link).toHaveAttribute("data-router-link", "")
      expect(link).toHaveAttribute("data-to", to)
      expect(link).toHaveAttribute("href", href)
      expect(link).not.toHaveAttribute("target")
    }
    const external = screen.getByRole("link", { name: "example.com/careers" })
    expect(external).not.toHaveAttribute("data-router-link")
    expect(external).toHaveAttribute("href", "https://example.com/careers")
    expect(external).toHaveAttribute("target", "_blank")
    expect(external).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("opens a created document through the router", () => {
    render(
      <ReceiptDetail
        detail={{
          type: "paper.create",
          docId: "doc-1",
          docKind: "cv",
          name: "PM track CV",
          status: "draft",
        }}
      />
    )
    const link = screen.getByRole("link", { name: "PM track CV" })
    expect(link).toHaveAttribute("data-router-link", "")
    expect(link).toHaveAttribute("data-to", "/paper/$docId")
    expect(link).toHaveAttribute("href", "/paper/doc-1")
  })

  it("opens an empty Paper or Apply list through the router", async () => {
    emptyLists()
    const user = userEvent.setup()
    render(
      <ChatStoreProvider>
        <CoachWorkspace />
      </ChatStoreProvider>
    )
    const open = async (item: string, name: string, href: string) => {
      await user.click(await screen.findByRole("button", { name: "Add" }))
      await user.click(await screen.findByRole("menuitem", { name: item }))
      const link = await screen.findByRole("link", { name })
      expect(link).toHaveAttribute("data-router-link", "")
      expect(link).toHaveAttribute("data-to", href)
      expect(link).toHaveAttribute("href", href)
      await user.keyboard("{Escape}")
    }
    await open("Add from Paper", "Go to Paper", "/paper")
    await open("Add a job from Apply", "Go to Apply", "/apply")
  })
})
