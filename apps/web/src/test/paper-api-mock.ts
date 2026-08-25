import {
  DEFAULT_PAPER_DOC_NAME,
  PAPER_COMMANDS,
  PAPER_CONTENT_VERSION,
  decodePaperContent,
  emptyPaperDocument,
  type PaperContentKind,
  type PaperDoc,
  type PaperDocStatus,
} from "@workspace/domain"

import { apiBaseUrl } from "@/lib/api-url.ts"

import { samplePaperDocs } from "./paper-fixtures.ts"

type Store = {
  docs: PaperDoc[]
  failNext: { command: string; message: string } | null
}

const store: Store = {
  docs: samplePaperDocs(),
  failNext: null,
}

function cloneDocs(docs: PaperDoc[]): PaperDoc[] {
  return structuredClone(docs)
}

function isoNow() {
  return new Date().toISOString()
}

function pathOf(input: RequestInfo | URL) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  return new URL(raw, apiBaseUrl).pathname
}

function jsonOk<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status })
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

async function readBody(init?: RequestInit): Promise<unknown> {
  if (init?.body == null) return {}
  const text = String(init.body)
  if (text.trim() === "") return {}
  return JSON.parse(text) as unknown
}

function sortDocs(docs: PaperDoc[]) {
  return [...docs].sort((a, b) => {
    const byUpdated = b.updatedAt.localeCompare(a.updatedAt)
    if (byUpdated !== 0) return byUpdated
    return b.id.localeCompare(a.id)
  })
}

export function resetPaperApiMock() {
  store.docs = cloneDocs(samplePaperDocs())
  store.failNext = null
}

export function failNextPaperCommand(command: string, message: string) {
  store.failNext = { command, message }
}

export function getMockPaperDocs() {
  return store.docs
}

export function handlesPaperRequest(input: RequestInfo | URL) {
  const path = pathOf(input)
  return path.startsWith("/api/paper") || path.includes("/api/commands/paper.")
}

export async function paperApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()

  if (!handlesPaperRequest(input)) return null

  if (
    store.failNext &&
    method === "POST" &&
    path.endsWith(store.failNext.command)
  ) {
    const failure = store.failNext
    store.failNext = null
    return jsonError(400, "VALIDATION_ERROR", failure.message)
  }

  if (method === "GET" && path === "/api/paper") {
    return jsonOk(sortDocs(store.docs))
  }

  const detail = /^\/api\/paper\/([^/]+)$/.exec(path)
  if (method === "GET" && detail) {
    const doc = store.docs.find((item) => item.id === detail[1])
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    return jsonOk(doc)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${PAPER_COMMANDS.createDoc}`
  ) {
    const body = (await readBody(init)) as {
      kind?: PaperContentKind
      name?: string
      content?: unknown
    }
    const kind = body.kind
    if (!kind) {
      return jsonError(400, "VALIDATION_ERROR", "Kind is required")
    }
    const content =
      body.content === undefined
        ? emptyPaperDocument(kind)
        : (() => {
            const decoded = decodePaperContent(
              kind,
              PAPER_CONTENT_VERSION,
              body.content
            )
            return decoded.ok ? decoded.data : null
          })()
    if (!content) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid content")
    }
    const now = isoNow()
    const created: PaperDoc = {
      id: crypto.randomUUID(),
      name: body.name?.trim() || DEFAULT_PAPER_DOC_NAME[kind],
      kind,
      status: "draft",
      content,
      contentVersion: PAPER_CONTENT_VERSION,
      createdAt: now,
      updatedAt: now,
    }
    store.docs.unshift(created)
    return jsonOk(created)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${PAPER_COMMANDS.updateContent}`
  ) {
    const body = (await readBody(init)) as {
      docId?: string
      content?: unknown
      contentVersion?: number
    }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    const decoded = decodePaperContent(
      doc.kind,
      body.contentVersion ?? doc.contentVersion,
      body.content
    )
    if (!decoded.ok) {
      return jsonError(400, "VALIDATION_ERROR", decoded.message)
    }
    doc.content = decoded.data
    doc.contentVersion = body.contentVersion ?? doc.contentVersion
    doc.updatedAt = isoNow()
    return jsonOk(doc)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${PAPER_COMMANDS.renameDoc}`
  ) {
    const body = (await readBody(init)) as { docId?: string; name?: string }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    doc.name = body.name?.trim() || doc.name
    doc.updatedAt = isoNow()
    return jsonOk(doc)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${PAPER_COMMANDS.setStatus}`
  ) {
    const body = (await readBody(init)) as {
      docId?: string
      status?: PaperDocStatus
    }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    if (body.status) doc.status = body.status
    doc.updatedAt = isoNow()
    return jsonOk(doc)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${PAPER_COMMANDS.deleteDoc}`
  ) {
    const body = (await readBody(init)) as { docId?: string }
    const index = store.docs.findIndex((item) => item.id === body.docId)
    if (index === -1) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    const [removed] = store.docs.splice(index, 1)
    return jsonOk({ id: removed!.id })
  }

  return jsonError(404, "UNKNOWN_COMMAND", "Unknown command")
}
