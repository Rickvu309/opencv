import {
  act,
  fireEvent,
  screen,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { render } from "@/test/render-with-client.tsx"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fetchProfile, profileKey } from "@/lib/account-api.ts"
import { catalogClient } from "@/lib/contract-client.ts"

const usageKey = () => catalogClient.key("", "coach.usage", {})
const fetchUsage = () => catalogClient.read("coach.usage", {})
import { chatApiFetch, scriptCoachStream } from "@/test/chat-api-mock.ts"
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

function stubUsage(
  day: { used: number; remaining: number },
  plan: "free" | "pro" = "free",
  mode: "free" | "light" | "max" = "free"
) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/reads/coach.usage"))
        return Response.json({
          ok: true,
          data: {
            plan,
            mode,
            session: { capped: false, resetsAt: "2026-10-29T00:00:00Z" },
            day: {
              capped: true,
              cap: 20,
              resetsAt: "2026-10-29T00:00:00Z",
              ...day,
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
}

describe("Coach workspace", () => {
  it("shows stopped after cancelling before a new Chat is created", async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const starts: string[] = []
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname
        if (path === "/api/public-config")
          return Response.json({ google: false, coachDurable: true })
        if (path.endsWith("chat.create")) await gate
        if (path.endsWith("coach.start")) starts.push(path)
        return (
          (await chatApiFetch(input, init)) ??
          (await profileApiFetch(input, init)) ??
          new Response("{}", { status: 404 })
        )
      }
    )
    const user = userEvent.setup()
    render(
      <ChatStoreProvider>
        <CoachWorkspace />
      </ChatStoreProvider>,
      { coachDurable: true }
    )
    await user.type(
      await screen.findByRole("textbox", { name: "Message Coach" }),
      "Stop this new Chat"
    )
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(await screen.findByRole("button", { name: "Stop" }))
    await act(async () => release())
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Stop" })).toBeNull()
    )
    expect(await screen.findByText("The Coach stopped.")).toBeVisible()
    expect(screen.queryByText("Stop this new Chat")).not.toBeInTheDocument()
    expect(screen.queryByText("How can I help?")).not.toBeInTheDocument()
    expect(starts).toEqual([])
  })

  it.each([
    { state: "welcome", compact: false, chatId: undefined },
    {
      state: "saved conversation",
      compact: false,
      chatId: "11111111-1111-4111-8111-111111111111",
    },
    { state: "compact", compact: true, chatId: undefined },
  ])(
    "keeps removable links with the $state draft",
    async ({ compact, chatId }) => {
      const user = userEvent.setup()
      render(
        <ChatStoreProvider>
          <CoachWorkspace
            chatId={chatId}
            presentation={compact ? "compact" : "page"}
          />
        </ChatStoreProvider>
      )
      if (chatId) {
        await screen.findByText(
          "I don't know if I should chase internships or finish my CV first."
        )
      }
      const textbox = await screen.findByRole("textbox", {
        name: "Message Coach",
      })
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add" })).toBeEnabled()
      )
      await user.type(textbox, "Review this role")
      await user.click(screen.getByRole("button", { name: "Add" }))
      await user.click(
        await screen.findByRole("menuitem", { name: "Paste a job link" })
      )
      await user.type(
        screen.getByRole("textbox", { name: "Link URL" }),
        "https://jobs.example.com/role"
      )
      await user.click(screen.getByRole("button", { name: "Attach link" }))
      const chip = await screen.findByRole("button", {
        name: "Remove jobs.example.com/role",
      })
      const group = textbox.closest('[data-slot="coach-workspace-composer"]')
      expect(group).toContainElement(chip)
      expect(
        document.querySelectorAll('[data-slot="coach-workspace-composer"]')
      ).toHaveLength(1)
      await user.click(chip)
      expect(
        screen.queryByRole("button", { name: "Remove jobs.example.com/role" })
      ).not.toBeInTheDocument()
      expect(textbox).toHaveValue("Review this role")
    }
  )

  it("greets in the empty panel with the page's heading and starters, one header and the composer at the bottom", async () => {
    render(
      <ChatStoreProvider>
        <CoachWorkspace
          presentation="compact"
          headerActions={<span>Panel controls</span>}
        />
      </ChatStoreProvider>
    )
    const composer = await screen.findByPlaceholderText("Ask Coach anything")
    expect(composer).toBeVisible()
    const greeting = screen.getByRole("heading", { name: "How can I help?" })
    const home = greeting.closest('[data-slot="coach-home"]')
    expect(home).toHaveAttribute("data-size", "panel")
    expect(home?.contains(composer)).toBe(false)
    expect(
      (home?.compareDocumentPosition(composer) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      screen.getAllByRole("button", {
        name: /Review my CV|Write a cover letter|Prep an interview/,
      })
    ).toHaveLength(3)
    expect(
      screen.getAllByRole("button", { name: "History, Chats" })
    ).toHaveLength(1)
    expect(screen.getByText("Panel controls")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "History, Chats" }))
    expect(
      await screen.findByRole("textbox", { name: "Search chat history" })
    ).toBeVisible()
  })

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

  it("builds the page header on the kit and leaves the leading slot free", async () => {
    render(
      <ChatStoreProvider>
        <CoachWorkspace chatId="11111111-1111-4111-8111-111111111111" />
      </ChatStoreProvider>
    )
    await screen.findByText(
      "I don't know if I should chase internships or finish my CV first."
    )
    const header = document.querySelector('[data-slot="page-header"]')
    expect(header).toBeInTheDocument()
    expect(header?.tagName).toBe("HEADER")
    expect(header?.querySelectorAll("h1")).toHaveLength(1)
    expect(header?.querySelector("h1")).toHaveTextContent("Coach")
    expect(
      header?.querySelector('[data-slot="page-header-leading"]')
    ).toBeNull()
    const [history, newChat] = Array.from(
      header?.querySelectorAll("button") ?? []
    )
    expect(history).toHaveAttribute("data-slot", "coach-history-trigger")
    expect(newChat).toHaveAccessibleName("New chat")
    expect(newChat).toHaveAttribute("data-slot", "page-header-action")
    expect(
      document.querySelector('[data-slot="coach-panel-header"]')
    ).toBeNull()
  })

  it("shows no New chat action on the home screen", async () => {
    render(
      <ChatStoreProvider>
        <CoachWorkspace />
      </ChatStoreProvider>
    )
    await screen.findByText("How can I help?")
    const header = document.querySelector('[data-slot="page-header"]')
    expect(header).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "New chat" })
    ).not.toBeInTheDocument()
  })

  it("keeps the compact panel off the page header", async () => {
    render(
      <ChatStoreProvider>
        <CoachWorkspace presentation="compact" />
      </ChatStoreProvider>
    )
    await screen.findByPlaceholderText("Ask Coach anything")
    expect(document.querySelector('[data-slot="page-header"]')).toBeNull()
    expect(
      document.querySelector('[data-slot="coach-panel-header"]')
    ).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole("button", { name: "New chat" }))
    await screen.findByText("How can I help?")
    await waitFor(() =>
      expect(
        screen.queryByText(
          "I don't know if I should chase internships or finish my CV first."
        )
      ).not.toBeInTheDocument()
    )
    const composer = screen.getByPlaceholderText("Ask Coach anything")
    const recent = await screen.findByRole("list", { name: "Recent chats" })
    expect(
      composer.compareDocumentPosition(recent) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Review my CV" })
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(recent).getByRole("button", { name: /^CV vs internship first/ })
    )
    expect(
      await screen.findByText(
        "I don't know if I should chase internships or finish my CV first."
      )
    ).toBeVisible()
  })

  it("disables sending and shows the reset with no Upgrade link when capped", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/api/reads/coach.usage"))
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
    await screen.findByRole("status")
    expect(
      screen.getByRole("textbox", { name: "Message Coach" })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    expect(screen.getByRole("status")).toHaveTextContent(
      /Resets (today|tomorrow) at \d/
    )
    expect(
      within(screen.getByRole("status")).queryByRole("link")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /upgrade/i })
    ).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Daily limit reached")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Choose Coach mode" })
    ).toBeEnabled()
    const card = document.querySelector("[data-slot=coach-composer-card]")
    expect(card).toContainElement(screen.getByRole("status"))
    expect(card).toContainElement(screen.getByRole("button", { name: "Send" }))
  })

  it("shows only a Chats history trigger on an empty home, with no chat title or New chat button", async () => {
    render(
      <ChatStoreProvider>
        <CoachWorkspace />
      </ChatStoreProvider>
    )
    const trigger = await screen.findByRole("button", {
      name: "History, Chats",
    })
    expect(trigger).toHaveTextContent("Chats")
    expect(screen.queryByText("New chat")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "New chat" })
    ).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(
      await screen.findByRole("textbox", { name: "Search chat history" })
    ).toBeInTheDocument()
  })

  it.each([
    { state: "welcome", compact: false, chatId: undefined },
    {
      state: "saved conversation",
      compact: false,
      chatId: "11111111-1111-4111-8111-111111111111",
    },
    { state: "compact", compact: true, chatId: undefined },
  ])(
    "keeps the daily count out of the $state composer",
    async ({ compact, chatId }) => {
      stubUsage({ used: 17, remaining: 3 })
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      client.setQueryData(usageKey(), await fetchUsage())
      render(
        <QueryClientProvider client={client}>
          <ChatStoreProvider>
            <CoachWorkspace
              chatId={chatId}
              presentation={compact ? "compact" : "page"}
            />
          </ChatStoreProvider>
        </QueryClientProvider>
      )
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: "Message Coach" })
        ).toBeEnabled()
      )
      if (chatId)
        expect(
          await screen.findByText(/Evidence over panic/)
        ).toBeInTheDocument()
      expect(
        screen.queryByText(/turns remaining today/)
      ).not.toBeInTheDocument()
    }
  )
  it.each(["light", "max"] as const)(
    "does not upsell a capped Pro %s user",
    async (mode) => {
      stubUsage({ used: 20, remaining: 0 }, "pro", mode)
      render(
        <ChatStoreProvider>
          <CoachWorkspace />
        </ChatStoreProvider>
      )
      expect(
        await screen.findByText(
          `You’ve reached today’s ${mode === "light" ? "Light" : "Max"} limit`
        )
      ).toBeVisible()
      expect(
        screen.queryByText(/Pro has unlimited Coach chats/)
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: "Upgrade" })
      ).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    }
  )
  it.each(["capped", "off"] as const)(
    "removes Retry and Regenerate when Coach becomes %s",
    async (blocked) => {
      stubUsage({ used: 17, remaining: 3 })
      const usage = await fetchUsage()
      const profile = await fetchProfile()
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      scriptCoachStream({
        httpError: {
          status: 503,
          code: "COACH_UNAVAILABLE",
          message: "The Coach is unavailable right now",
        },
      })
      const view = render(
        <QueryClientProvider client={client}>
          <ChatStoreProvider>
            <CoachWorkspace chatId="11111111-1111-4111-8111-111111111111" />
          </ChatStoreProvider>
        </QueryClientProvider>
      )
      try {
        const buttons = await screen.findAllByRole("button", {
          name: "Regenerate",
        })
        expect(
          buttons.filter((button) => !button.hasAttribute("disabled"))
        ).toHaveLength(1)
        const composer = screen.getByRole("textbox", { name: "Message Coach" })
        await waitFor(() => expect(composer).toBeEnabled())
        fireEvent.change(composer, { target: { value: "Try this turn" } })
        fireEvent.click(screen.getByRole("button", { name: "Send" }))
        expect(
          await screen.findByRole("button", { name: "Retry" })
        ).toBeEnabled()
        act(() => {
          if (blocked === "capped")
            client.setQueryData(usageKey(), {
              ...usage,
              day: {
                ...usage.day,
                capped: true,
                cap: 20,
                used: 20,
                remaining: 0,
              },
            })
          else
            client.setQueryData(profileKey(""), {
              ...profile,
              agentChat: false,
            })
        })
        await waitFor(() => {
          expect(
            screen.queryByRole("button", { name: "Retry" })
          ).not.toBeInTheDocument()
          expect(
            screen.queryByRole("button", { name: "Regenerate" })
          ).not.toBeInTheDocument()
          expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
        })
      } finally {
        view.unmount()
        client.clear()
        scriptCoachStream()
      }
    }
  )
})
