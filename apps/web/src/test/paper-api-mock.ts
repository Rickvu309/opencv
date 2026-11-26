import {
  blankCv,
  paperDocumentInfoSchema,
  type PaperContentKind,
} from "@workspace/domain/paper-doc"

import { samplePaperDocs, type PaperDoc } from "./paper-fixtures.ts"
import { isoNow, pathOf, jsonOk, jsonError } from "./mock-http.ts"

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
    path.endsWith("/api/reads/paper.list") ||
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

  const info =
    method === "POST" && path === "/api/reads/paper.read"
      ? ((await readBody(init)) as { view?: string; docId?: string })
      : null
  if (!handlesPaperRequest(input) && info?.view !== "info") return null

  if (
    store.failNext &&
    method === "POST" &&
    path.endsWith(store.failNext.command)
  ) {
    const failure = store.failNext
    store.failNext = null
    return jsonError(400, "VALIDATION_ERROR", failure.message)
  }

  if (method === "POST" && path === "/api/reads/paper.list") {
    if (store.listGate) await store.listGate
    if (store.failList) return jsonError(500, "INTERNAL", "Server error")
    return jsonOk(sortDocs(store.docs).map(toWire))
  }

  if (method === "POST" && path === "/api/reads/paper.files") {
    return jsonOk([])
  }

  if (info?.view === "info") {
    const doc = store.docs.find((item) => item.id === info.docId)
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
      content: kind === "letter" ? { markdown: "" } : blankCv(),
      contentVersion: 1,
      applyCardId: null,
      createdAt: now,
      updatedAt: now,
    }
    store.docs.unshift(created)
    return jsonOk(toWire(created))
  }

  if (method === "POST" && path === "/api/commands/paper.update") {
    const body = (await readBody(init)) as {
      docId?: string
      patch?: { name?: string; isFavorite?: boolean; status?: string }
    }
    const doc = store.docs.find((item) => item.id === body.docId)
    if (!doc) return jsonError(404, "NOT_FOUND", "Paper doc not found")
    const patch = body.patch ?? {}
    if (patch.name !== undefined) doc.name = patch.name.trim() || doc.name
    if (patch.status) doc.status = patch.status
    if (patch.isFavorite !== undefined)
      setMockPaperFavorite(doc.id, patch.isFavorite)
    if (patch.name !== undefined || patch.status) doc.updatedAt = isoNow()
    return jsonOk(toWire(doc))
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

export function paperUpdateResult(
  id: string,
  name: string,
  kind: "cv" | "letter" = "cv"
) {
  return {
    ok: true,
    data: {
      id,
      name,
      kind,
      status: "draft",
      isFavorite: false,
      updatedAt: new Date(0).toISOString(),
    },
  }
}
