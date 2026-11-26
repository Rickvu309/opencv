import type {
  NativeWriter,
  NativeProvenance,
  PaperDocument,
} from "@workspace/domain/paper-doc"
import type { PaperYDoc } from "@workspace/paper-crdt"
import type { paperDocs } from "../db/schema.js"

export type PaperRow = typeof paperDocs.$inferSelect

export type Live = {
  readonly yDoc: PaperYDoc
  readonly epoch: number
  baseSeq: number
  base: Buffer
  revision: number
  tip: Buffer | null
}

export type ContentEdit = {
  readonly origin: string
  readonly editId?: string
  readonly target: PaperDocument | ((current: PaperDocument) => PaperDocument)
  readonly witness?: unknown
}

export type LogRow = {
  readonly seq: number
  readonly origin: string
  readonly editId: string | null
  readonly basedOn: number | null
  readonly touched: string[] | null
  readonly rebuilt: string[] | null
  readonly update: Uint8Array
}

export type Appended = {
  readonly origin: "coach" | "revert"
  readonly editId: string
  readonly basedOn?: number
  readonly touched?: string[] | ((merged: PaperDocument) => string[])
  readonly rebuilt?: string[] | ((merged: PaperDocument) => string[])
  readonly protect?: readonly Uint8Array[]
  readonly update: Uint8Array
  readonly keepIfIneffective?: boolean
  readonly check?: (merged: PaperDocument) => string[]
}

export type AppendResult = {
  readonly row: PaperRow | null
  readonly problems: string[]
}

export type LockedContent = {
  readonly row: PaperRow
  readonly document: PaperDocument
  readonly baseSeq: number
  edit(change: ContentEdit): Promise<PaperRow>
  fork(basedOn: number): Promise<PaperYDoc>
  history(): Promise<{ base: Uint8Array; rows: LogRow[] }>
  append(change: Appended): Promise<AppendResult>
}

export type SyncRequest = {
  readonly writer?: NativeWriter
  readonly provenance?: NativeProvenance
  readonly epoch: number
  readonly update: Uint8Array
  readonly stateVector: Uint8Array
  readonly basedOn?: number | undefined
}

export type SyncReply = {
  readonly provenance?: NativeProvenance
  readonly epoch: number
  readonly revision: number
  readonly reset: boolean
  readonly stale: boolean
  readonly update: Uint8Array
  readonly stateVector: Uint8Array
}
