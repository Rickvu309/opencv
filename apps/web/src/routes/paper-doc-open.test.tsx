import { blankCv, ERROR_CODES } from "@workspace/domain"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"

import { paperListKey } from "@/features/paper/paper-api.ts"
import { PaperDocPage } from "@/routes/paper-doc.tsx"

const WORD_PAGE = "22222222-2222-4222-8222-222222222222"
const OLDER_DOC = "33333333-3333-4333-8333-333333333333"
const MISSING = "44444444-4444-4444-8444-444444444444"
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
      data: { user: { id: "owner-1" } },
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

function missing() {
  return Response.json(
    { ok: false, error: { code: ERROR_CODES.NOT_FOUND, message: "Missing" } },
    { status: 404 }
  )
}

function answer(url: string, body: string): Response | null {
  if (url.includes(`/api/paper/${WORD_PAGE}`)) return ok(wordView)
  if (url.includes(`/api/paper/${OLDER_DOC}/pages`))
    return ok({ docId: OLDER_DOC, pages: 1, pageChoice: "unset" })
  if (url.includes(`/api/paper/${OLDER_DOC}`)) return ok(olderView)
  if (url.includes(`/api/paper/${MISSING}`)) return missing()
  if (url.includes("/api/reads/paper.read"))
    return body.includes(WORD_PAGE) ? ok(wordRead) : missing()
  if (url.includes("/api/chats") || url.includes("/api/jobs")) return ok([])
  return null
}

function stubServer(held: string[] = []) {
  const exchanges: Exchange[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    const response = held.some((path) => url.endsWith(path))
      ? null
      : answer(url, String(init?.body ?? ""))
    if (!response) return new Promise<Response>(() => undefined)
    exchanges.push({ url, status: response.status })
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
  if (listed) client.setQueryData(paperListKey(), listed)
  render(
    <QueryClientProvider client={client}>
      <PaperDocPage />
    </QueryClientProvider>
  )
  return client
}

const failed = (exchanges: Exchange[]) =>
  exchanges.filter((exchange) => exchange.status >= 400)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("opening a document from its link", () => {
  it("opens a Word page from a direct link with no failed request", async () => {
    const exchanges = stubServer()
    open(`/paper/${WORD_PAGE}`)
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    expect(failed(exchanges)).toEqual([])
  })

  it("opens a Word page from the library without asking which kind it is first", async () => {
    const exchanges = stubServer([`/api/paper/${WORD_PAGE}`])
    open(`/paper/${WORD_PAGE}`, [wordView, olderView])
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    expect(failed(exchanges)).toEqual([])
  })

  it("opens an older document from a direct link on its own editor", async () => {
    const exchanges = stubServer()
    open(`/paper/${OLDER_DOC}`)
    await waitFor(() =>
      expect(
        exchanges.some((exchange) =>
          exchange.url.includes(`/api/paper/${OLDER_DOC}/pages`)
        )
      ).toBe(true)
    )
    expect(failed(exchanges)).toEqual([])
    expect(
      exchanges.some((exchange) => exchange.url.includes("paper.read"))
    ).toBe(false)
    expect(screen.queryByText("Document not found.")).toBeNull()
  })

  it("opens an older document from the library on its own editor", async () => {
    const exchanges = stubServer()
    open(`/paper/${OLDER_DOC}`, [wordView, olderView])
    await waitFor(() =>
      expect(
        exchanges.some((exchange) =>
          exchange.url.includes(`/api/paper/${OLDER_DOC}/pages`)
        )
      ).toBe(true)
    )
    expect(failed(exchanges)).toEqual([])
    expect(
      exchanges.some((exchange) => exchange.url.includes("paper.read"))
    ).toBe(false)
  })

  it("shows the not-found state for a link to a missing document", async () => {
    stubServer()
    open(`/paper/${MISSING}`)
    expect(await screen.findByText("Document not found.")).toBeVisible()
  })
})
