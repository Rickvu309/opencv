import type { QueryName } from "@workspace/domain/kernel"
import { getTableConfig, PgTable } from "drizzle-orm/pg-core"

import * as schema from "../db/schema.js"

type Schema = typeof schema

type OwnedKey = {
  [K in keyof Schema]: Schema[K] extends PgTable
    ? "userId" extends keyof Schema[K]
      ? K
      : "ownerId" extends keyof Schema[K]
        ? K
        : never
    : never
}[keyof Schema]

function isOwned(value: unknown): value is PgTable {
  return value instanceof PgTable && ("userId" in value || "ownerId" in value)
}

function pickOwned(all: Schema) {
  return Object.fromEntries(
    Object.entries(all).filter(([, value]) => isOwned(value))
  ) as { [K in OwnedKey]: Schema[K] }
}

export const ownedTables = pickOwned(schema)

export type OwnedTable = keyof typeof ownedTables

export type OwnedRow = Record<string, unknown>

export type OwnedReads = {
  list: QueryName | readonly QueryName[] | "unlisted"
  open: QueryName | "none"
  openInput?: (id: string) => Record<string, string>
  shownWhen?: (row: OwnedRow) => boolean
  idOf: (row: OwnedRow) => string
}

const byId = (row: OwnedRow) => String(row.id)
const hidden: OwnedReads = { list: "unlisted", open: "none", idOf: byId }

export const OWNED_READS: { [T in OwnedTable]: OwnedReads } = {
  session: hidden,
  account: hidden,
  connections: hidden,
  oauthClient: hidden,
  oauthRefreshToken: hidden,
  oauthAccessToken: hidden,
  oauthConsent: hidden,
  agentConnections: { list: "connections.list", open: "none", idOf: byId },
  agentToolCalls: hidden,
  files: {
    list: "paper.files",
    open: "file.get",
    openInput: (fileId) => ({ fileId }),
    shownWhen: (row) => row.purpose !== "package",
    idOf: byId,
  },
  paperDocs: {
    list: "paper.list",
    open: "paper.read",
    openInput: (docId) => ({ view: "info", docId }),
    idOf: byId,
  },
  jobs: {
    list: "job.list",
    open: "job.get",
    openInput: (jobId) => ({ jobId }),
    idOf: byId,
  },
  inboxThreads: {
    list: ["inbox.list", "inbox.snoozed"],
    open: "inbox.get",
    openInput: (threadId) => ({ threadId }),
    idOf: byId,
  },
  chats: {
    list: "chat.list",
    open: "chat.get",
    openInput: (chatId) => ({ chatId }),
    idOf: byId,
  },
  pendingActions: hidden,
  activity: { list: "activity.list", open: "none", idOf: byId },
  idempotency: { ...hidden, idOf: (row) => String(row.key) },
  notifyRequests: hidden,
  coachTasks: {
    list: "unlisted",
    open: "coach.status",
    openInput: (taskId) => ({ taskId }),
    idOf: byId,
  },
  coachUsage: hidden,
}

export type OwnedTableName = {
  key: OwnedTable
  schema: string
  name: string
}

export function ownedTableNames(): OwnedTableName[] {
  return (Object.keys(ownedTables) as OwnedTable[]).map((key) => {
    const config = getTableConfig(ownedTables[key])
    return { key, schema: config.schema ?? "public", name: config.name }
  })
}

export function listReadsOf(reads: OwnedReads): readonly QueryName[] {
  if (reads.list === "unlisted") return []
  return typeof reads.list === "string" ? [reads.list] : reads.list
}

export type Invariant = "OWN-1" | "OWN-2" | "OWN-3" | "OWN-4" | "OWN-5"

export type RedKey = `${OwnedTable}:${Invariant}`

export type RowSighting = {
  ownerListed: boolean | null
  ownerOpens: boolean | null
  strangerListed: boolean | null
  strangerOpen: string | null
  missingOpen: string | null
}

export function shown(table: OwnedTable, row: OwnedRow) {
  return OWNED_READS[table].shownWhen?.(row) ?? true
}

export function rowBreaks(seen: RowSighting): Invariant[] {
  const breaks: Invariant[] = []
  if (seen.ownerListed === false) breaks.push("OWN-1")
  if (seen.ownerOpens === false) breaks.push("OWN-2")
  if (seen.strangerOpen !== null && seen.strangerOpen !== seen.missingOpen)
    breaks.push("OWN-3")
  if (seen.strangerListed === true) breaks.push("OWN-4")
  return breaks
}

export type RerunSighting = {
  touched: readonly OwnedTable[]
  named: OwnedTable | null
  strangerAnswer: string
  missingAnswer: string | null
}

export function rerunBreaks(seen: RerunSighting): RedKey[] {
  const keys = new Set<RedKey>(
    seen.touched.map((table) => `${table}:OWN-5` as const)
  )
  if (
    seen.named &&
    seen.missingAnswer !== null &&
    seen.strangerAnswer !== seen.missingAnswer
  )
    keys.add(`${seen.named}:OWN-5`)
  return [...keys]
}

export function ratchetProblems(
  found: ReadonlyMap<string, readonly string[]>,
  known: Readonly<Record<string, number>>
): string[] {
  const fresh = [...found.keys()]
    .filter((key) => !(key in known))
    .sort()
    .map(
      (key) =>
        `${key} breaks: ${(found.get(key) ?? []).slice(0, 3).join("; ")}. Fix the code that wrote the row; the known-reds list may only shrink.`
    )
  const fixed = Object.keys(known)
    .filter((key) => !found.has(key))
    .sort()
    .map(
      (key) =>
        `${key} holds now. Remove it from apps/api/src/registry/owned-known-reds.json.`
    )
  return [...fresh, ...fixed]
}
