import {
  emptyCvDocument,
  paperDocumentInfoSchema,
  type PaperContentKind,
} from "@workspace/domain"

import { samplePaperDocs } from "./paper-fixtures.ts"
import { isoNow, pathOf, jsonOk, jsonError } from "./mock-http.ts"

type PaperDoc = {
  id: string
  name: string
  kind: PaperContentKind
  status: string
  content: unknown
  contentVersion: number
  applyCardId: string | null
  createdAt: string
  updatedAt: string
}

type Store = {
  docs: PaperDoc[]
  failNext: { command: string; message: string } | null
  listGate: Promise<void> | null
  failList: boolean
  favoriteIds: Set<string>
}

const store: Store = {
  docs: samplePaperDocs(),
  failNext: null,
  listGate: null,
  failList: false,
  favoriteIds: new Set(),
}

function cloneDocs(docs: PaperDoc[]): PaperDoc[] {
  return structuredClone(docs)
}

async function readBody(init?: RequestInit): Promise<unknown> {
  if (init?.body == null) return {}
  const text = String(init.body)
  if (text.trim() === "") return {}
  const body = JSON.parse(text) as unknown
  return body && typeof body === "object" && "input" in body ? body.input : body
}

function toWire(doc: PaperDoc) {
  const extra = doc as PaperDoc & { pageChoice?: string; templateId?: string }
  return {
    id: doc.id,
    name: doc.name,
    kind: doc.kind,
    templateId: extra.templateId ?? "simple",
    status: doc.status,
    document: doc.content,
    contentVersion: doc.contentVersion,
    checks: [],
    pageChoice: extra.pageChoice === "keep" ? "keep" : "unset",
    sourceFileId: null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    isFavorite: store.favoriteIds.has(doc.id),
  }
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
  store.listGate = null
  store.failList = false
  store.favoriteIds = new Set()
}

export function setMockPaperFavorite(docId: string, isFavorite: boolean) {
  if (isFavorite) store.favoriteIds.add(docId)
  else store.favoriteIds.delete(docId)
}

export function failPaperList(fail = true) {
  store.failList = fail
}

export function holdPaperList() {
  let release: () => void = () => {}
  store.listGate = new Promise<void>((resolve) => {
    release = resolve
  })
  return () => {
    store.listGate = null
    release()
  }
}

export function failNextPaperCommand(command: string, message: string) {
  store.failNext = { command, message }
}

export function getMockPaperDocs() {
  return store.docs
}

export function patchMockPaperDoc(id: string, patch: Partial<PaperDoc>) {
  const doc = store.docs.find((item) => item.id === id)
  if (!doc) return null
  Object.assign(doc, patch)
  if (!patch.updatedAt) doc.updatedAt = isoNow()
  return doc
}

export function handlesPaperRequest(input: RequestInfo | URL) {
  const path = pathOf(input)
  return (
    path.startsWith("/api/paper") ||
    path.includes("/api/commands/paper.") ||
    path.endsWith("/api/commands/job.linkPaper") ||
    path.endsWith("/api/commands/job.unlinkPaper")
  )
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
    if (store.listGate) await store.listGate
    if (store.failList) return jsonError(500, "INTERNAL", "Server error")
    return jsonOk(sortDocs(store.docs).map(toWire))
  }

  if (method === "GET" && path === "/api/paper/files") {
    return jsonOk([])
  }

  const identity = /^\/api\/paper\/([^/]+)\/document$/.exec(path)
  if (method === "GET" && identity) {
    const doc = store.docs.find((item) => item.id === identity[1])
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    return jsonOk(
      paperDocumentInfoSchema.parse({
        id: doc.id,
        name: doc.name,
        kind: doc.kind,
        format: "prose",
      })
    )
  }

  const pages = /^\/api\/paper\/([^/]+)\/pages$/.exec(path)
  if (method === "GET" && pages) {
    const doc = store.docs.find((item) => item.id === pages[1])
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    const pageChoice =
      (doc as { pageChoice?: string }).pageChoice === "keep" ? "keep" : "unset"
    return jsonOk({ docId: doc.id, pages: 1, pageChoice })
  }

  const shared = /^\/api\/paper\/shared\/([^/]+)$/.exec(path)
  if (method === "GET" && shared) {
    return jsonError(404, "NOT_FOUND", "This link does not open a document.")
  }

  const detail = /^\/api\/paper\/([^/]+)$/.exec(path)
  if (method === "GET" && detail) {
    const doc = store.docs.find((item) => item.id === detail[1])
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    return jsonOk(toWire(doc))
  }

  if (method === "POST" && path === "/api/commands/paper.setStatus") {
    const body = (await readBody(init)) as {
      docId?: string
      status?: string
    }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    if (body.status) doc.status = body.status
    doc.updatedAt = isoNow()
    return jsonOk(toWire(doc))
  }

  if (method === "POST" && path === "/api/commands/paper.create") {
    const body = (await readBody(init)) as {
      kind?: PaperContentKind
      name?: string
      templateId?: string
    }
    const kind = body.kind === "letter" ? "letter" : "cv"
    const now = isoNow()
    const created: PaperDoc = {
      id: crypto.randomUUID(),
      name: body.name?.trim() || (kind === "letter" ? "Cover letter" : "CV"),
      kind,
      status: "draft",
      content: kind === "letter" ? { markdown: "" } : emptyCvDocument(),
      contentVersion: 1,
      applyCardId: null,
      createdAt: now,
      updatedAt: now,
    }
    store.docs.unshift(created)
    return jsonOk(toWire(created))
  }

  if (method === "POST" && path === "/api/commands/paper.rename") {
    const body = (await readBody(init)) as { docId?: string; name?: string }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    doc.name = body.name?.trim() || doc.name
    doc.updatedAt = isoNow()
    return jsonOk(toWire(doc))
  }

  if (method === "POST" && path === "/api/commands/paper.setFavorite") {
    const body = (await readBody(init)) as {
      docId?: string
      isFavorite?: boolean
    }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    setMockPaperFavorite(doc.id, body.isFavorite === true)
    return jsonOk({ docId: doc.id, isFavorite: body.isFavorite === true })
  }

  if (method === "POST" && path === "/api/commands/paper.duplicate") {
    const body = (await readBody(init)) as { docId?: string }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    const now = isoNow()
    const copy: PaperDoc = {
      ...structuredClone(doc),
      id: crypto.randomUUID(),
      name: `${doc.name} copy`,
      createdAt: now,
      updatedAt: now,
    }
    store.docs.unshift(copy)
    return jsonOk(toWire(copy))
  }

  if (method === "POST" && path === "/api/commands/paper.delete") {
    const body = (await readBody(init)) as { docId?: string }
    const index = store.docs.findIndex((item) => item.id === body.docId)
    if (index === -1) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    store.docs.splice(index, 1)
    return jsonOk({ id: body.docId })
  }

  if (method === "POST" && path === "/api/commands/paper.share") {
    const body = (await readBody(init)) as { docId?: string }
    return jsonOk({ docId: body.docId, token: `share-${body.docId ?? "doc"}` })
  }

  if (method === "POST" && path === "/api/commands/paper.keepTwoPages") {
    const body = (await readBody(init)) as { docId?: string }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    ;(doc as PaperDoc & { pageChoice?: string }).pageChoice = "keep"
    doc.updatedAt = isoNow()
    return jsonOk(toWire(doc))
  }

  if (method === "POST" && path === "/api/commands/paper.setTemplate") {
    const body = (await readBody(init)) as {
      docId?: string
      templateId?: string
    }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    ;(doc as PaperDoc & { templateId?: string }).templateId = body.templateId
    doc.updatedAt = isoNow()
    return jsonOk(toWire(doc))
  }

  if (method === "POST" && path === "/api/commands/job.linkPaper") {
    const body = (await readBody(init)) as { docId?: string; jobId?: string }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    doc.applyCardId = body.jobId ?? doc.applyCardId
    doc.updatedAt = isoNow()
    return jsonOk({ jobId: body.jobId, docId: body.docId })
  }

  if (method === "POST" && path === "/api/commands/job.unlinkPaper") {
    const body = (await readBody(init)) as { jobId?: string; kind?: string }
    for (const doc of store.docs) {
      if (doc.applyCardId === body.jobId) doc.applyCardId = null
    }
    return jsonOk({ jobId: body.jobId })
  }

  return jsonError(404, "UNKNOWN_COMMAND", "Unknown command")
}
