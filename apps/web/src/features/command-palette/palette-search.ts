import { chatDisplayTitle } from "@workspace/domain/coach"
import { catalog } from "@workspace/domain/kernel"
import { STAGE_LABEL, type Stage } from "@workspace/ui/components/stage-icon"

import { catalogClient } from "@/lib/contract-client.ts"
import { SURFACES, type SurfaceId } from "@/lib/product-paths.ts"

export const PALETTE_PAGES: {
  id: string
  label: string
  surface: SurfaceId
}[] = SURFACES.filter((surface) => surface.shown && surface.inSearch).map(
  (surface) => ({
    id: surface.id,
    label: surface.label,
    surface: surface.id,
  })
)

export const PALETTE_SCOPES = [
  { id: "all", label: "All" },
  { id: "jobs", label: "Jobs" },
  { id: "paper", label: "Paper" },
  { id: "chats", label: "Chats" },
  { id: "pages", label: "Pages" },
] as const

export type PaletteScope = (typeof PALETTE_SCOPES)[number]["id"]

export type PaletteChat = { id: string; title: string }

export type PaletteJob = {
  id: string
  title: string
  company: string
  stage: string | null
}

export type PaletteDocument = {
  id: string
  name: string
  kind: string
}

export type SearchHits = {
  jobs: PaletteJob[]
  documents: PaletteDocument[]
  chats: PaletteChat[]
}

export type PaletteRow =
  | { kind: "page"; id: string; label: string; surface: SurfaceId }
  | {
      kind: "job"
      id: string
      title: string
      company: string
      stage: string | null
    }
  | { kind: "paper"; id: string; name: string; kindLabel: "CV" | "Letter" }
  | { kind: "chat"; id: string; title: string }

const EMPTY_HITS: SearchHits = { jobs: [], documents: [], chats: [] }

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function stageWord(stage: string | null | undefined) {
  if (!stage || !(stage in STAGE_LABEL)) return null
  return STAGE_LABEL[stage as Stage]
}

function paperKindLabel(kind: string): "CV" | "Letter" | null {
  if (kind === "cv") return "CV"
  if (kind === "letter") return "Letter"
  return null
}

function parseJobs(value: unknown): PaletteJob[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    const id = text(row?.id)
    const title = text(row?.title)
    if (!id || !title) return []
    return [
      {
        id,
        title,
        company: text(row?.company),
        stage: text(row?.stage) || null,
      },
    ]
  })
}

function parseDocuments(value: unknown): PaletteDocument[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    const id = text(row?.id)
    const name = text(row?.name)
    if (!id || !name) return []
    return [{ id, name, kind: text(row?.kind) }]
  })
}

function parseChats(value: unknown): PaletteChat[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    const id = text(row?.id)
    const title = text(row?.title)
    if (!id || !title) return []
    return [{ id, title }]
  })
}

export function parseSearchHits(data: unknown): SearchHits {
  const row = record(data)
  if (!row) return EMPTY_HITS
  return {
    jobs: parseJobs(row.jobs),
    documents: parseDocuments(row.documents),
    chats: parseChats(row.chats),
  }
}

export async function searchWorkspace(query: string) {
  return parseSearchHits(
    await catalogClient.read(catalog["workspace.search"].name, { query })
  )
}

export async function listPaletteChats() {
  try {
    const chats = await catalogClient.read(catalog["chat.list"].name, {})
    return parseChats(chats).slice(0, 8)
  } catch {
    return []
  }
}

function inScope(row: PaletteRow, scope: PaletteScope) {
  if (scope === "all") return true
  if (scope === "jobs") return row.kind === "job"
  if (scope === "paper") return row.kind === "paper"
  if (scope === "chats") return row.kind === "chat"
  return row.kind === "page"
}

export function paletteRows(input: {
  query: string
  scope: PaletteScope
  hits: SearchHits | null
  recent: PaletteChat[]
  failed: boolean
}): PaletteRow[] {
  const query = input.query.trim()
  if (query && (input.failed || input.hits === null)) return []

  const needle = query.toLowerCase()
  const pages: PaletteRow[] = PALETTE_PAGES.filter((page) =>
    needle ? page.label.toLowerCase().includes(needle) : true
  ).map((page) => ({
    kind: "page",
    id: `page:${page.id}`,
    label: page.label,
    surface: page.surface,
  }))

  const jobs: PaletteRow[] = query
    ? (input.hits?.jobs ?? []).map((job) => ({
        kind: "job",
        id: `job:${job.id}`,
        title: job.title,
        company: job.company,
        stage: job.stage,
      }))
    : []

  const paper: PaletteRow[] = query
    ? (input.hits?.documents ?? []).flatMap((doc) => {
        const kindLabel = paperKindLabel(doc.kind)
        if (!kindLabel) return []
        return [
          {
            kind: "paper" as const,
            id: `paper:${doc.id}`,
            name: doc.name,
            kindLabel,
          },
        ]
      })
    : []

  const chats: PaletteRow[] = (
    query ? (input.hits?.chats ?? []) : input.recent
  ).map((chat) => ({
    kind: "chat" as const,
    id: `chat:${chat.id}`,
    title: chatDisplayTitle(chat.title),
  }))

  return [...pages, ...jobs, ...paper, ...chats].filter((row) =>
    inScope(row, input.scope)
  )
}

export function rowProperties(row: PaletteRow) {
  if (row.kind === "job") {
    const stage = stageWord(row.stage)
    return [row.title, row.company, stage].filter(Boolean).join(", ")
  }
  if (row.kind === "paper") return `${row.name}, ${row.kindLabel}`
  if (row.kind === "chat") return row.title
  return row.label
}
