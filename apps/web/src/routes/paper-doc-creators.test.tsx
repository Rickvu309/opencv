import { blankCv, blankLetter, ERROR_CODES } from "@workspace/domain"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"

import { importPaperFile, paperListKey } from "@/features/paper/paper-api.ts"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { runContractCommand } from "@/lib/contract-client.ts"
import { PaperDocPage } from "@/routes/paper-doc.tsx"

const WHEN = "2026-11-13T00:00:00.000Z"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const HASH = "a".repeat(64)

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
      data: { user: { id: "owner-1" } },
      isPending: false,
      error: null,
    }),
  },
}))

type Kind = "cv" | "letter"
type Format = "word" | "older"
type Stored = {
  id: string
  name: string
  kind: Kind
  format: Format
  mine: boolean
  deleted: boolean
}
type Exchange = { url: string; status: number; method: string }

function idNumber(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
}

function view(page: Stored) {
  return {
    id: page.id,
    name: page.name,
    kind: page.kind,
    templateId: "simple",
    status: "draft",
    paper: page.kind === "cv" ? blankCv() : blankLetter(),
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    ...(page.format === "word" ? { format: "word" } : {}),
    createdAt: WHEN,
    updatedAt: WHEN,
  }
}

function wordRead(page: Stored) {
  return {
    doc: page.id,
    revision: REVISION,
    name: page.name,
    label: page.kind,
    paragraphs: [
      {
        handle: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        text: "",
        pieces: [],
        held: false,
        message: "",
        code: null,
      },
    ],
  }
}

const ok = (data: unknown) => Response.json({ ok: true, data })
const refused = (status: number) =>
  Response.json(
    { ok: false, error: { code: ERROR_CODES.NOT_FOUND, message: "Missing" } },
    { status }
  )

function fakeServer(options: { listFails?: number } = {}) {
  let listFails = options.listFails ?? 0
  let next = 100
  const pages = new Map<string, Stored>()
  const exchanges: Exchange[] = []
  const add = (
    format: Format,
    kind: Kind = "cv",
    extra: Partial<Stored> = {}
  ) => {
    next += 1
    const page: Stored = {
      id: idNumber(next),
      name: format === "word" ? "Page.docx" : "Older CV",
      kind,
      format,
      mine: true,
      deleted: false,
      ...extra,
    }
    pages.set(page.id, page)
    return page
  }
  const live = (id: string) => {
    const page = pages.get(id)
    return page && page.mine && !page.deleted ? page : undefined
  }
  const copyOf = (id: string) => {
    const source = live(id)
    if (!source) return refused(404)
    const copy = add(source.format, source.kind)
    return ok(source.format === "word" ? view(copy) : view(copy))
  }
  const commands: Record<string, (input: Record<string, unknown>) => Response> =
    {
      "paper.canvas": (input) => {
        const page = add("word", input.label === "letter" ? "letter" : "cv")
        return ok({ docId: page.id, revision: REVISION })
      },
      "paper.start": (input) => {
        const page = add("word", input.kind === "letter" ? "letter" : "cv")
        return ok({ docId: page.id, revision: REVISION })
      },
      "paper.create": () => ok(view(add("older"))),
      "paper.duplicate": (input) => copyOf(String(input.docId)),
      "paper.restoreDeleted": (input) => {
        const page = pages.get(String(input.docId))
        if (!page?.mine) return refused(404)
        page.deleted = false
        return ok(view(page))
      },
    }
  const answer = (url: string, body: string, method: string) => {
    const path = url.split("?")[0] ?? ""
    if (path.endsWith("/api/paper") && method === "GET" && listFails > 0) {
      listFails -= 1
      return refused(500)
    }
    if (path.endsWith("/api/paper") && method === "GET")
      return ok(
        [...pages.values()]
          .filter((page) => page.mine && !page.deleted)
          .map(view)
      )
    if (path.endsWith("/api/paper/import")) {
      const page = add("word")
      return Response.json({
        ok: true,
        data: {
          generation: "package",
          docId: page.id,
          revision: REVISION,
          name: page.name,
          kind: page.kind,
          packageHash: HASH,
          byteSize: 10,
        },
      })
    }
    const pagesOf = path.match(/\/api\/paper\/([0-9a-f-]{36})\/pages$/)
    if (pagesOf?.[1]) {
      const page = live(pagesOf[1])
      return page?.format === "older"
        ? ok({ docId: page.id, pages: 1, pageChoice: "unset" })
        : refused(404)
    }
    const one = path.match(/\/api\/paper\/([0-9a-f-]{36})$/)
    if (one?.[1]) {
      const page = live(one[1])
      return page?.format === "older" ? ok(view(page)) : refused(404)
    }
    if (path.endsWith("/api/reads/paper.read")) {
      const page = [...pages.values()].find(
        (item) => body.includes(item.id) && item.format === "word"
      )
      return page && live(page.id) ? ok(wordRead(page)) : refused(409)
    }
    const command = path.match(/\/api\/commands\/([a-zA-Z.]+)$/)
    if (command?.[1]) {
      const run = commands[command[1]]
      const parsed = JSON.parse(body || "{}") as {
        input?: Record<string, unknown>
      }
      return run ? run(parsed.input ?? {}) : ok({})
    }
    if (path.includes("/api/chats") || path.includes("/api/jobs")) return ok([])
    return null
  }
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input).replace(
      /^https?:\/\/[^/]+/,
      ""
    )
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase()
    const response = answer(url, String(init?.body ?? ""), method)
    if (!response) return Promise.reject(new TypeError("Failed to fetch"))
    exchanges.push({
      url: url.split("?")[0] ?? "",
      status: response.status,
      method,
    })
    return new Promise<Response>((resolve) =>
      setTimeout(() => resolve(response), 20)
    )
  })
  return {
    pages,
    exchanges,
    add,
    listed: () =>
      [...pages.values()]
        .filter((page) => page.mine && !page.deleted)
        .map(view),
  }
}

type Server = ReturnType<typeof fakeServer>
type Creator = {
  format: Format
  make: (server: Server, client: QueryClient) => Promise<string>
}

const word = "word" as const
const older = "older" as const

function file(name: string, type: string) {
  return new File(["Imported words"], name, { type })
}

async function imported(file: File) {
  return (await importPaperFile(file)).docId
}

function idOf(output: unknown) {
  const shaped = output as { docId?: string; id?: string }
  return shaped.docId ?? shaped.id ?? ""
}

const CREATORS: Record<string, Creator> = {
  "Start blank": {
    format: word,
    make: async (_server, client) =>
      idOf(
        await runContractCommand(client, "paper.canvas", {
          op: "mint",
          label: "cv",
        })
      ),
  },
  "Start from a template": {
    format: word,
    make: async (_server, client) =>
      idOf(
        await runContractCommand(client, "paper.canvas", {
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
        await runContractCommand(client, "paper.canvas", {
          op: "mint",
          label: "letter",
          jobId: "66666666-6666-4666-8666-666666666666" as never,
        })
      ),
  },
  "Coach start": {
    format: word,
    make: async (_server, client) =>
      idOf(
        await runContractCommand(client, "paper.start", {
          kind: "cv",
          templateId: "modern",
        })
      ),
  },
  "Import a Word file": {
    format: word,
    make: () =>
      imported(
        file(
          "Imported.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ),
  },
  "Import a PDF": {
    format: word,
    make: () => imported(file("Imported.pdf", "application/pdf")),
  },
  "Import a text file": {
    format: word,
    make: () => imported(file("Imported.txt", "text/plain")),
  },
  "Duplicate an imported page": {
    format: word,
    make: async (server, client) =>
      idOf(
        await runContractCommand(client, "paper.duplicate", {
          docId: server.add("word").id as never,
        })
      ),
  },
  "Restore a page from trash": {
    format: word,
    make: async (server, client) =>
      idOf(
        await runContractCommand(client, "paper.restoreDeleted", {
          docId: server.add("word", "cv", { deleted: true }).id as never,
        })
      ),
  },
  "Older document": {
    format: older,
    make: async (_server, client) =>
      idOf(
        await runContractCommand(client, "paper.create", {
          kind: "cv",
          name: "Older CV",
        })
      ),
  },
  "Duplicate an older document": {
    format: older,
    make: async (server, client) =>
      idOf(
        await runContractCommand(client, "paper.duplicate", {
          docId: server.add("older").id as never,
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
  if (format === "word") {
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
  } else {
    await waitFor(() =>
      expect(server.exchanges.map((exchange) => exchange.url)).toContain(
        `/api/paper/${docId}/pages`
      )
    )
    await waitFor(
      () => expect(document.querySelector('[aria-busy="true"]')).toBeNull(),
      { timeout: 5000 }
    )
  }
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
      queryClient.setQueryData(paperListKey(), server.listed())
      const go = mount(`/paper/${home.id}`, queryClient)
      expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
      const docId = await creator.make(server, queryClient)
      go(`/paper/${docId}`)
      await expectOpened(server, creator.format, docId)
    })

    it("opens from the library with a list read before it was made", async () => {
      const server = fakeServer()
      const queryClient = client()
      queryClient.setQueryData(paperListKey(), server.listed())
      const docId = await creator.make(server, queryClient)
      mount(`/paper/${docId}`, queryClient)
      await expectOpened(server, creator.format, docId)
    })

    it("opens from the library with a list that shows it", async () => {
      const server = fakeServer()
      const queryClient = client()
      const docId = await creator.make(server, queryClient)
      queryClient.setQueryData(paperListKey(), server.listed())
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
    (exchange) => exchange.url === "/api/paper" && exchange.method === "GET"
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
    queryClient.setQueryData(paperListKey(), server.listed())
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
      { url: `/api/paper/${idNumber(999)}`, status: 404, method: "GET" },
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
    queryClient.setQueryData(paperListKey(), server.listed())
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

  it("a list read that keeps failing shows the true error with Refresh, and reads the list once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const server = fakeServer({ listFails: 1000 })
    mount(`/paper/${idNumber(999)}`, client())
    await settleForAMinute()
    expect(shown()).toBe("load error")
    expect(screen.getByRole("button", { name: "Refresh" })).toBeVisible()
    expect(listReads(server)).toBe(1)
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
