import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { NATIVE_WRITER } from "@workspace/domain/paper-doc"

import { paperListQuery } from "@/lib/paper-list.ts"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { catalogClient } from "@/lib/contract-client.ts"
import { PaperDocPage } from "@/routes/paper-doc.tsx"
import {
  fakeServer,
  idNumber,
  type Format,
  type Server,
  type Stored,
} from "@/test/paper-doc-server.ts"

const route = vi.hoisted(() => ({ pathname: "/paper" }))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => undefined,
  useRouterState: (options: {
    select: (state: {
      location: { pathname: string; search: Record<string, never> }
    }) => unknown
  }) => options.select({ location: { pathname: route.pathname, search: {} } }),
}))

vi.mock("@/lib/auth-client.ts", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "owner-1" }, session: { id: "session-1" } },
      isPending: false,
      error: null,
    }),
  },
}))

type Creator = {
  format: Format
  make: (server: Server, client: QueryClient) => Promise<string>
}

const word = "word" as const

function idOf(output: unknown) {
  const shaped = output as { docId?: string; id?: string }
  return shaped.docId ?? shaped.id ?? ""
}

const CREATORS: Record<string, Creator> = {
  "Start blank": {
    format: word,
    make: async (_server, client) =>
      idOf(
        await catalogClient.run(client, "paper.canvas", {
          op: "mint",
          label: "cv",
        })
      ),
  },
  "Start from a template": {
    format: word,
    make: async (_server, client) =>
      idOf(
        await catalogClient.run(client, "paper.canvas", {
          op: "mint",
          label: "cv",
          templateId: "modern",
        })
      ),
  },
  "Start a letter for a Job": {
    format: word,
    make: async (_server, client) =>
      idOf(
        await catalogClient.run(client, "paper.canvas", {
          op: "mint",
          label: "letter",
          jobId: "66666666-6666-4666-8666-666666666666",
        })
      ),
  },
  "Coach start": {
    format: word,
    make: async (_server, client) =>
      idOf(
        await catalogClient.run(client, "paper.start", {
          kind: "cv",
          templateId: "modern",
        })
      ),
  },
  "Duplicate an imported page": {
    format: word,
    make: async (server, client) =>
      idOf(
        await catalogClient.run(client, "paper.duplicate", {
          docId: server.add("word").id,
          writer: NATIVE_WRITER,
        })
      ),
  },
  "Restore a page from trash": {
    format: word,
    make: async (server, client) =>
      idOf(
        await catalogClient.run(client, "paper.recover", {
          docId: server.add("word", "cv", { deleted: true }).id,
        })
      ),
  },
  "The person's own agent, through the API": {
    format: word,
    make: async (server) => server.add("word").id,
  },
  "Another tab": {
    format: word,
    make: async (server) => server.add("word").id,
  },
}

function client() {
  const made = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  made.setQueryData(["coach-config"], { coachDurable: false })
  return made
}

function tree(queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <ChatStoreProvider>
        <PaperDocPage />
      </ChatStoreProvider>
    </QueryClientProvider>
  )
}

function mount(pathname: string, queryClient: QueryClient) {
  route.pathname = pathname
  const rendered = render(tree(queryClient))
  return (next: string) => {
    route.pathname = next
    rendered.rerender(tree(queryClient))
  }
}

const failed = (server: Server) =>
  server.exchanges.filter((exchange) => exchange.status >= 400)

async function expectOpened(server: Server, format: Format, docId: string) {
  expect(format).toBe("word")
  expect(docId).not.toBe("")
  expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
  expect(screen.queryByText("Document not found.")).toBeNull()
  expect(screen.queryByText(/Could not load documents/)).toBeNull()
  expect(failed(server)).toEqual([])
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe.each(Object.entries(CREATORS))(
  "a page made by %s",
  (_name, creator) => {
    it("opens right after it is made, in a page that was already open, without a reload", async () => {
      const server = fakeServer()
      const home = server.add("word")
      const queryClient = client()
      queryClient.setQueryData(
        paperListQuery("owner-1").queryKey,
        server.listed()
      )
      const go = mount(`/paper/${home.id}`, queryClient)
      expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
      const docId = await creator.make(server, queryClient)
      go(`/paper/${docId}`)
      await expectOpened(server, creator.format, docId)
    })

    it("opens from the library with a list read before it was made", async () => {
      const server = fakeServer()
      const queryClient = client()
      queryClient.setQueryData(
        paperListQuery("owner-1").queryKey,
        server.listed()
      )
      const docId = await creator.make(server, queryClient)
      mount(`/paper/${docId}`, queryClient)
      await expectOpened(server, creator.format, docId)
    })

    it("opens from the library with a list that shows it", async () => {
      const server = fakeServer()
      const queryClient = client()
      const docId = await creator.make(server, queryClient)
      queryClient.setQueryData(
        paperListQuery("owner-1").queryKey,
        server.listed()
      )
      mount(`/paper/${docId}`, queryClient)
      await expectOpened(server, creator.format, docId)
    })

    it("opens after a reload", async () => {
      const server = fakeServer()
      const docId = await creator.make(server, client())
      mount(`/paper/${docId}`, client())
      await expectOpened(server, creator.format, docId)
    })
  }
)

const listReads = (server: Server) =>
  server.exchanges.filter(
    (exchange) =>
      exchange.url === "/api/reads/paper.list" && exchange.method === "POST"
  ).length

async function settleForAMinute() {
  await vi.advanceTimersByTimeAsync(60_000)
}

function shown() {
  if (screen.queryByRole("article", { name: "Page" })) return "page"
  if (screen.queryByText("Document not found.")) return "not found"
  if (screen.queryByText("Could not load documents. Refresh the page."))
    return "load error"
  if (screen.queryByText("Loading documents")) return "loading"
  return "other"
}

type Outcome = { screen: string; listReads: number; html: string }

async function openedOn(
  server: Server,
  queryClient: QueryClient,
  start: string | null,
  steps: (go: (path: string) => void) => void,
  target: string
): Promise<Outcome> {
  const go = mount(start ?? `/paper/${target}`, queryClient)
  if (start) {
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    server.exchanges.length = 0
    steps(go)
  }
  await settleForAMinute()
  const outcome = {
    screen: shown(),
    listReads: listReads(server),
    html: document.body.innerHTML.replaceAll(target, "{id}"),
  }
  cleanup()
  return outcome
}

describe("the route decides once and stops", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  async function directLink(
    prepare: (server: Server) => string,
    serverOptions: { listFails?: number } = {}
  ) {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const server = fakeServer(serverOptions)
    const target = prepare(server)
    const outcome = await openedOn(server, client(), null, () => {}, target)
    return { ...outcome, server }
  }

  async function fromOpenPage(
    prepare: (server: Server) => { target: string; after?: () => void },
    path: (target: string) => string[] = (target) => [`/paper/${target}`]
  ) {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const server = fakeServer()
    const home = server.add("word")
    const { target, after } = prepare(server)
    const queryClient = client()
    queryClient.setQueryData(
      paperListQuery("owner-1").queryKey,
      server.listed()
    )
    after?.()
    const outcome = await openedOn(
      server,
      queryClient,
      `/paper/${home.id}`,
      (go) => path(target).forEach(go),
      target
    )
    return { ...outcome, server }
  }

  it("a missing id: Document not found., at most two list reads, then nothing", async () => {
    const outcome = await directLink(() => idNumber(999))
    expect(outcome.screen).toBe("not found")
    expect(outcome.listReads).toBeLessThanOrEqual(2)
    expect(
      outcome.server.exchanges.filter((exchange) => exchange.status >= 400)
    ).toEqual([
      {
        url: "/api/reads/paper.read",
        status: 404,
        method: "POST",
      },
    ])
  })

  it("another person's id looks exactly like a missing id", async () => {
    const stranger = await directLink(
      (server) => server.add("word", "cv", { mine: false }).id
    )
    const missing = await directLink(() => idNumber(999))
    expect(stranger.screen).toBe("not found")
    expect(stranger.listReads).toBeLessThanOrEqual(2)
    expect({
      screen: stranger.screen,
      html: stranger.html,
      reads: stranger.listReads,
    }).toEqual({
      screen: missing.screen,
      html: missing.html,
      reads: missing.listReads,
    })
  })

  it("a page deleted elsewhere that this tab still lists: Document not found., at most two list reads", async () => {
    let gone: Stored | undefined
    const outcome = await fromOpenPage((server) => {
      gone = server.add("word")
      return { target: gone.id, after: () => gone && (gone.deleted = true) }
    })
    expect(outcome.screen).toBe("not found")
    expect(outcome.listReads).toBeLessThanOrEqual(2)
  })

  it("a page made elsewhere opens, with at most two list reads", async () => {
    let made = ""
    const outcome = await fromOpenPage(
      (server) => ({
        target: idNumber(500),
        after: () => {
          made = server.add("word").id
        },
      }),
      () => [`/paper/${made}`]
    )
    expect(outcome.screen).toBe("page")
    expect(outcome.listReads).toBeLessThanOrEqual(2)
  })

  it("an ordinary page from the library opens with one list read", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const server = fakeServer()
    const page = server.add("word")
    const queryClient = client()
    queryClient.setQueryData(
      paperListQuery("owner-1").queryKey,
      server.listed()
    )
    const outcome = await openedOn(server, queryClient, null, () => {}, page.id)
    expect(outcome.screen).toBe("page")
    expect(outcome.listReads).toBeLessThanOrEqual(1)
  })

  it("a direct link in a fresh tab opens with one list read", async () => {
    const outcome = await directLink((server) => server.add("word").id)
    expect(outcome.screen).toBe("page")
    expect(outcome.listReads).toBeLessThanOrEqual(1)
  })

  it("a list read that fails once still opens the page, with at most two list reads", async () => {
    const outcome = await directLink((server) => server.add("word").id, {
      listFails: 1,
    })
    expect(outcome.screen).toBe("page")
    expect(outcome.listReads).toBeLessThanOrEqual(2)
  })

  it("a failed document read shows its true error without reading the library", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const server = fakeServer({ documentFails: true })
    mount(`/paper/${idNumber(999)}`, client())
    await settleForAMinute()
    expect(screen.getByText("Could not open this document.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible()
    expect(screen.queryByText("Document not found.")).toBeNull()
    expect(listReads(server)).toBe(0)
  })

  it("rapid navigation across five pages ends on the last one with no extra list read", async () => {
    let pages: string[] = []
    const outcome = await fromOpenPage(
      (server) => {
        pages = [1, 2, 3, 4, 5].map(() => server.add("word").id)
        return { target: pages[4] ?? "" }
      },
      () => pages.map((id) => `/paper/${id}`)
    )
    expect(outcome.screen).toBe("page")
    expect(outcome.html).toContain("{id}")
    expect(outcome.listReads).toBeLessThanOrEqual(1)
  })
})
