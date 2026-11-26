import { blankCv, ERROR_CODES } from "@workspace/domain"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { paperListQuery } from "@/lib/paper-list.ts"
import { refreshQueries } from "@/lib/contract-client.ts"
import { PaperDocPage } from "@/routes/paper-doc.tsx"

const WORD_PAGE = "22222222-2222-4222-8222-222222222222"
const OLDER_DOC = "33333333-3333-4333-8333-333333333333"
const MISSING = "44444444-4444-4444-8444-444444444444"
const STRANGERS = "55555555-5555-4555-8555-555555555555"
const WHEN = "2026-11-13T00:00:00.000Z"

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

function view(id: string, name: string, format?: "word") {
  return {
    id,
    name,
    kind: "cv",
    templateId: "simple",
    status: "draft",
    paper: blankCv(),
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    ...(format ? { format } : {}),
    createdAt: WHEN,
    updatedAt: WHEN,
  }
}

const wordView = view(WORD_PAGE, "Cv.docx", "word")
const olderView = view(OLDER_DOC, "Older CV")

const wordRead = {
  doc: WORD_PAGE,
  revision: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Cv.docx",
  label: "cv",
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

type Exchange = { url: string; status: number }

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function missing(status = 404) {
  return Response.json(
    { ok: false, error: { code: ERROR_CODES.NOT_FOUND, message: "Missing" } },
    { status }
  )
}

function answer(url: string, body: string, listFails: boolean) {
  const path = url.split("?")[0] ?? ""
  if (path.endsWith("/api/reads/paper.list"))
    return listFails ? missing(500) : ok([wordView, olderView])
  if (path.endsWith(`/api/paper/${WORD_PAGE}/document`))
    return ok({ id: WORD_PAGE, name: "Cv.docx", kind: "cv", format: "word" })
  if (path.endsWith(`/api/paper/${OLDER_DOC}/document`))
    return ok({ id: OLDER_DOC, name: "Older CV", kind: "cv", format: "prose" })
  if (path.endsWith(`/api/paper/${OLDER_DOC}/pages`))
    return ok({ docId: OLDER_DOC, pages: 1, pageChoice: "unset" })
  if (path.endsWith(`/api/paper/${OLDER_DOC}`)) return ok(olderView)
  if (path.includes("/api/paper/")) return missing()
  if (path.endsWith("/api/reads/paper.read"))
    return body.includes(WORD_PAGE) ? ok(wordRead) : missing(409)
  if (path.includes("/api/chats") || path.includes("/api/reads/job.list"))
    return ok([])
  return null
}

function stubServer({ listFails = false } = {}) {
  const exchanges: Exchange[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    const response = answer(url, String(init?.body ?? ""), listFails)
    if (!response) return new Promise<Response>(() => undefined)
    exchanges.push({ url: url.split("?")[0] ?? "", status: response.status })
    return Promise.resolve(response)
  })
  return exchanges
}

function open(pathname: string, listed?: unknown[]) {
  route.pathname = pathname
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(["coach-config"], { coachDurable: false })
  if (listed) client.setQueryData(paperListQuery("owner-1").queryKey, listed)
  render(
    <QueryClientProvider client={client}>
      <PaperDocPage />
    </QueryClientProvider>
  )
  return client
}

const failed = (exchanges: Exchange[]) =>
  exchanges.filter((exchange) => exchange.status >= 400)

const paperRequests = (exchanges: Exchange[]) =>
  exchanges
    .map((exchange) => exchange.url.replace(/^.*\/api\//, ""))
    .filter((path) => path.startsWith("paper") || path.startsWith("reads"))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("opening a document from its link", () => {
  it("refreshes document metadata after a product command invalidates it", async () => {
    const exchanges = stubServer()
    const client = open(`/paper/${WORD_PAGE}`)
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    await refreshQueries(client, [
      { query: "paper.read", input: { view: "info", docId: WORD_PAGE } },
    ])
    expect(
      paperRequests(exchanges).filter(
        (path) => path === `paper/${WORD_PAGE}/document`
      )
    ).toHaveLength(2)
  })

  it("opens a Word page from a direct link with no failed request and no older read", async () => {
    const exchanges = stubServer()
    open(`/paper/${WORD_PAGE}`)
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    expect(failed(exchanges)).toEqual([])
    expect(paperRequests(exchanges)).toEqual([
      `paper/${WORD_PAGE}/document`,
      "reads/paper.list",
      "reads/paper.read",
    ])
  })

  it("opens a Word page from the library with no failed request and no older read", async () => {
    const exchanges = stubServer()
    open(`/paper/${WORD_PAGE}`, [wordView, olderView])
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    expect(failed(exchanges)).toEqual([])
    expect(paperRequests(exchanges)).not.toContain(`paper/${WORD_PAGE}`)
    expect(paperRequests(exchanges)).toContain("reads/paper.read")
  })

  it.each([
    ["a missing document", MISSING],
    ["another person's document", STRANGERS],
  ])(
    "shows the not-found state for %s with one failed request",
    async (_case, id) => {
      const exchanges = stubServer()
      open(`/paper/${id}`)
      expect(await screen.findByText("Document not found.")).toBeVisible()
      expect(failed(exchanges)).toEqual([
        {
          url: expect.stringContaining(`/api/paper/${id}`),
          status: 404,
        },
      ])
      expect(paperRequests(exchanges)).toEqual([`paper/${id}/document`])
      expect(paperRequests(exchanges)).not.toContain("reads/paper.read")
    }
  )

  it("opens a page imported a moment ago, when the cached list was read before the import", async () => {
    const exchanges = stubServer()
    open(`/paper/${WORD_PAGE}`, [olderView])
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    expect(failed(exchanges)).toEqual([])
    expect(paperRequests(exchanges)).toEqual([
      `paper/${WORD_PAGE}/document`,
      "reads/paper.list",
      "reads/paper.read",
    ])
  })

  it("still opens a Word page when the document list cannot load", async () => {
    stubServer({ listFails: true })
    open(`/paper/${WORD_PAGE}`)
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
  })
})
