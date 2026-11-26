import { ERROR_CODES } from "@workspace/domain/kernel"
import { blankCv, blankLetter } from "@workspace/domain/paper-doc"
import { afterEach, vi } from "vitest"
import { wordPageReceipt } from "./word-page-receipt.ts"

const WHEN = "2026-11-13T00:00:00.000Z"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const HASH = "a".repeat(64)

type Kind = "cv" | "letter"
export type Format = "word" | "older"
export type Stored = {
  id: string
  name: string
  kind: Kind
  format: Format
  mine: boolean
  deleted: boolean
}
type Exchange = { url: string; status: number; method: string }

export function idNumber(n: number) {
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
    {
      ok: false,
      error: {
        code: status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.INTERNAL,
        message: "Missing",
      },
    },
    { status }
  )

export function fakeServer(
  options: { listFails?: number; documentFails?: boolean } = {}
) {
  let listFails = options.listFails ?? 0
  let next = 100
  const pages = new Map<string, Stored>()
  const exchanges: Exchange[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  afterEach(() => {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  })
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
        return ok(wordPageReceipt({ docId: page.id, revision: REVISION }))
      },
      "paper.start": (input) => {
        const page = add("word", input.kind === "letter" ? "letter" : "cv")
        return ok(wordPageReceipt({ docId: page.id, revision: REVISION }))
      },
      "paper.create": () => ok(view(add("older"))),
      "paper.duplicate": (input) => copyOf(String(input.docId)),
      "paper.recover": (input) => {
        const page = pages.get(String(input.docId))
        if (!page?.mine) return refused(404)
        page.deleted = false
        return ok(view(page))
      },
    }
  const answer = (url: string, body: string, method: string) => {
    const path = url.split("?")[0] ?? ""
    if (
      path.endsWith("/api/reads/paper.list") &&
      method === "POST" &&
      listFails > 0
    ) {
      listFails -= 1
      return refused(500)
    }
    if (path.endsWith("/api/reads/paper.list") && method === "POST")
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
    const metadata = path.match(/\/api\/paper\/([0-9a-f-]{36})\/document$/)
    if (metadata?.[1]) {
      if (options.documentFails) return refused(500)
      const page = live(metadata[1])
      return page
        ? ok({
            id: page.id,
            name: page.name,
            kind: page.kind,
            format: page.format === "word" ? "word" : "prose",
          })
        : refused(404)
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
    if (path.includes("/api/chats") || path.includes("/api/reads/job.list"))
      return ok([])
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
    return new Promise<Response>((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        resolve(response)
      }, 20)
      timers.add(timer)
    })
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

export type Server = ReturnType<typeof fakeServer>
