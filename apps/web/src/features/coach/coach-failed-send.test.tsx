import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { render } from "@/test/render-with-client.tsx"
import { chatApiFetch } from "@/test/chat-api-mock.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { TASK, taskEvent, taskSnapshot } from "@/test/coach-task-fixture.ts"
import { ChatStoreProvider } from "./chat-store.tsx"
import { CoachWorkspace } from "./coach-workspace.tsx"

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<object>()),
  useNavigate: () => vi.fn(),
}))

const TEXT = "Keep this line"
const RAW = "SQLSTATE secret"
const SLOW = "slow down please"
const TIMED_OUT = "socket hung up after 30000ms"

type StartBody = {
  text?: string
  context?: { kind: string; id: string }[]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function log() {
  return screen.getByRole("log", { name: "Chat" })
}

function startBody(init?: RequestInit): StartBody {
  const body = JSON.parse(String(init?.body)) as { input?: StartBody }
  return body.input ?? {}
}

function personMessage(text: string) {
  return {
    id: "01900000-0000-7000-8000-000000000010",
    chatId: "01900000-0000-7000-8000-000000000002",
    role: "person" as const,
    text,
    parts: [],
    status: "final" as const,
    workedMs: null,
    createdAt: "2026-11-13T00:00:00.000Z",
  }
}

function succeeded(text: string) {
  return taskSnapshot({
    state: "succeeded",
    messages: [personMessage(text)],
  })
}

function failedAfterDraft(text: string) {
  return taskSnapshot({
    state: "failed",
    errorCode: "TASK_FAILED",
    cursor: 1,
    events: [taskEvent(1, "Partial answer")],
    messages: [personMessage(text)],
  })
}

function usageResponse() {
  return Response.json({
    ok: true,
    data: {
      plan: "free",
      mode: "free",
      session: { capped: false, resetsAt: "2026-11-14T00:00:00.000Z" },
      day: { capped: false, resetsAt: "2026-11-14T00:00:00.000Z" },
      week: { capped: false, resetsAt: "2026-11-16T00:00:00.000Z" },
    },
  })
}

async function sendLine(text: string) {
  const box = await screen.findByRole("textbox", { name: "Message Coach" })
  await waitFor(() => expect(box).toBeEnabled())
  fireEvent.change(box, { target: { value: text } })
  fireEvent.click(screen.getByRole("button", { name: "Send" }))
}

function installFetch(options: {
  presentation?: "page" | "compact"
  onStart?: (
    body: StartBody,
    init?: RequestInit
  ) => Response | Promise<Response>
  onCreate?: () => void
  snapshot?: ReturnType<typeof taskSnapshot>
}) {
  const starts: StartBody[] = []
  beforeEach(() => {
    starts.length = 0
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path === "/api/public-config")
          return Response.json({ google: false, coachDurable: true })
        if (path === "/api/coach/usage") return usageResponse()
        if (path.endsWith("chat.create")) options.onCreate?.()
        if (path.endsWith("coach.start") && options.onStart) {
          const body = startBody(init)
          starts.push(body)
          return options.onStart(body, init)
        }
        if (path.startsWith("/api/coach/tasks/") && options.snapshot)
          return Response.json({ ok: true, data: options.snapshot })
        return (
          (await chatApiFetch(input, init)) ??
          (await profileApiFetch(input, init)) ??
          new Response("{}", { status: 404 })
        )
      }
    )
  })
  return starts
}

function mount(presentation: "page" | "compact" = "page") {
  render(
    <ChatStoreProvider>
      <CoachWorkspace presentation={presentation} />
    </ChatStoreProvider>,
    { coachDurable: true }
  )
}

async function expectKept(sentence: string, hidden?: string) {
  expect(await screen.findByText(sentence)).toBeVisible()
  expect(within(log()).getAllByText(TEXT)).toHaveLength(1)
  expect(
    within(log()).getByText(TEXT).closest("[aria-invalid='true']")
  ).not.toBeNull()
  expect(screen.getByRole("textbox", { name: "Message Coach" })).toHaveValue("")
  if (hidden) expect(screen.queryByText(hidden)).not.toBeInTheDocument()
  expect(screen.queryByText("How can I help?")).not.toBeInTheDocument()
}

describe("a failed Coach send keeps the typed line", () => {
  describe.each(["page", "compact"] as const)("%s", (presentation) => {
    describe("network", () => {
      const starts = installFetch({
        onStart: () => {
          throw new TypeError("Failed to fetch")
        },
      })
      it("keeps the line and retries that text once", async () => {
        mount(presentation)
        await sendLine(TEXT)
        await expectKept(
          "Couldn't reach the Coach. Check your connection and try again."
        )
        fireEvent.click(screen.getByRole("button", { name: "Retry" }))
        await waitFor(() => expect(starts).toHaveLength(2))
        expect(starts.map((start) => start.text)).toEqual([TEXT, TEXT])
        expect(within(log()).getAllByText(TEXT)).toHaveLength(1)
        expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
      })
    })

    describe("server", () => {
      installFetch({
        onStart: () =>
          Response.json(
            { ok: false, error: { code: "INTERNAL_ERROR", message: RAW } },
            { status: 500 }
          ),
      })
      it("keeps the line and hides the raw error", async () => {
        mount(presentation)
        await sendLine(TEXT)
        await expectKept(
          "The Coach is unavailable right now. Try again in a moment.",
          RAW
        )
      })
    })

    describe("busy", () => {
      installFetch({
        onStart: () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: { code: "REQUEST_FAILED", message: SLOW },
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "2",
              },
            }
          ),
      })
      it("keeps the line and says how long to wait", async () => {
        mount(presentation)
        await sendLine(TEXT)
        await expectKept(
          "The Coach is getting too many requests. Wait 2 seconds, then retry.",
          SLOW
        )
      })
    })

    describe("timeout", () => {
      installFetch({
        onStart: () => {
          const error = new Error(TIMED_OUT)
          error.name = "TimeoutError"
          throw error
        },
      })
      it("keeps the line", async () => {
        mount(presentation)
        await sendLine(TEXT)
        await expectKept(
          "The Coach took too long to answer. Try again.",
          TIMED_OUT
        )
      })
    })

    describe("partial", () => {
      installFetch({
        onStart: () => Response.json({ ok: true, data: { taskId: TASK } }),
        snapshot: failedAfterDraft(TEXT),
      })
      it("keeps the line and the partial answer", async () => {
        mount(presentation)
        await sendLine(TEXT)
        expect(await within(log()).findByText("Partial answer")).toBeVisible()
        expect(within(log()).getAllByText(TEXT)).toHaveLength(1)
        expect(
          await screen.findByText("The Coach stopped. Try again.")
        ).toBeVisible()
      })
    })

    describe("attachment", () => {
      const starts = installFetch({
        onStart: () => {
          throw new TypeError("Failed to fetch")
        },
      })
      it("keeps the line and the link", async () => {
        mount(presentation)
        const user = userEvent.setup()
        const box = await screen.findByRole("textbox", {
          name: "Message Coach",
        })
        await waitFor(() => expect(box).toBeEnabled())
        await user.type(box, TEXT)
        await user.click(screen.getByRole("button", { name: "Add" }))
        await user.click(
          await screen.findByRole("menuitem", { name: "Paste a job link" })
        )
        await user.type(
          screen.getByRole("textbox", { name: "Link URL" }),
          "https://jobs.example.com/role"
        )
        await user.click(screen.getByRole("button", { name: "Attach link" }))
        await user.click(screen.getByRole("button", { name: "Send" }))
        await expectKept(
          "Couldn't reach the Coach. Check your connection and try again."
        )
        expect(
          screen.getByRole("button", { name: "Remove jobs.example.com/role" })
        ).toBeVisible()
        expect(within(log()).getByText("jobs.example.com/role")).toBeVisible()
        expect(starts[0]?.context).toEqual([
          { kind: "link", id: "https://jobs.example.com/role" },
        ])
      })
    })
  })

  describe("a lost start that then succeeds", () => {
    let attempt = 0
    const starts = installFetch({
      onStart: () => {
        attempt += 1
        if (attempt === 1) throw new TypeError("Failed to fetch")
        return Response.json({ ok: true, data: { taskId: TASK } })
      },
      snapshot: succeeded(TEXT),
    })
    beforeEach(() => {
      attempt = 0
    })
    it("shows the text once after Retry", async () => {
      mount()
      await sendLine(TEXT)
      await expectKept(
        "Couldn't reach the Coach. Check your connection and try again."
      )
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
      await waitFor(() => expect(starts).toHaveLength(2))
      await waitFor(() =>
        expect(
          screen.queryByText(
            "Couldn't reach the Coach. Check your connection and try again."
          )
        ).not.toBeInTheDocument()
      )
      expect(within(log()).getAllByText(TEXT)).toHaveLength(1)
      expect(starts.every((start) => start.text === TEXT)).toBe(true)
    })
  })

  describe("the chat was never created", () => {
    let creates = 0
    const starts = installFetch({
      onCreate: () => {
        creates += 1
        if (creates === 1) throw new TypeError("Failed to fetch")
      },
      onStart: () => Response.json({ ok: true, data: { taskId: TASK } }),
      snapshot: succeeded(TEXT),
    })
    beforeEach(() => {
      creates = 0
    })
    it("keeps the line and the retry creates the chat once", async () => {
      mount()
      await sendLine(TEXT)
      await expectKept(
        "Couldn't reach the Coach. Check your connection and try again."
      )
      expect(starts).toHaveLength(0)
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
      await waitFor(() => expect(starts).toHaveLength(1))
      expect(starts[0]?.text).toBe(TEXT)
      expect(creates).toBe(2)
      await waitFor(() =>
        expect(
          screen.queryByText(
            "Couldn't reach the Coach. Check your connection and try again."
          )
        ).not.toBeInTheDocument()
      )
      expect(within(log()).getAllByText(TEXT)).toHaveLength(1)
    })
  })
})
