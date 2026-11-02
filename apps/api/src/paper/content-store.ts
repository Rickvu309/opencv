import {
  ERROR_CODES,
  legacyPaperOf,
  paperDocumentSchema,
  upgradeStoredPaper,
  type PaperDocument,
  type PaperId,
  type PaperStoredKind,
  type UserId,
} from "@workspace/domain"
import {
  absorbUpdate,
  forkOf,
  loadYDoc,
  materialize,
  seedYDoc,
  stateVectorOf,
  updateSince,
  writeDocument,
  type PaperYDoc,
} from "@workspace/paper-crdt"
import { and, asc, eq, gte, gt } from "drizzle-orm"

import { getDb, transaction } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"

type PaperRow = typeof paperDocs.$inferSelect

type Live = {
  readonly yDoc: PaperYDoc
  readonly epoch: number
  readonly baseSeq: number
  readonly base: Buffer
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
  readonly update: Uint8Array
}

export type Appended = {
  readonly origin: "coach" | "revert"
  readonly editId: string
  readonly basedOn?: number
  readonly update: Uint8Array
  readonly keepIfIneffective?: boolean
}

export type LockedContent = {
  readonly row: PaperRow
  readonly document: PaperDocument
  readonly baseSeq: number
  edit(change: ContentEdit): Promise<PaperRow>
  fork(basedOn: number): Promise<PaperYDoc>
  history(): Promise<{ base: Uint8Array; rows: LogRow[] }>
  append(change: Appended): Promise<PaperRow | null>
}

export type SyncRequest = {
  readonly epoch: number
  readonly update: Uint8Array
  readonly stateVector: Uint8Array
}

export type SyncReply = {
  readonly epoch: number
  readonly revision: number
  readonly reset: boolean
  readonly update: Uint8Array
  readonly stateVector: Uint8Array
}

const FIRST_EPOCH = 1
const NO_LOCAL_COPY = 0

const CACHE_LIMIT = 200
const live = new Map<string, Live>()

function remember(docId: string, entry: Live) {
  live.delete(docId)
  live.set(docId, entry)
  for (const oldest of live.keys()) {
    if (live.size <= CACHE_LIMIT) break
    live.delete(oldest)
  }
}

function refuse(message: string) {
  return new CommandError(ERROR_CODES.VALIDATION_ERROR, message)
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return Buffer.from(a).equals(Buffer.from(b))
}

function validated(candidate: unknown, kind: PaperStoredKind): PaperDocument {
  const parsed = paperDocumentSchema.safeParse(candidate)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw refuse(issue?.message ?? "The document is not valid")
  }
  if (parsed.data.kind !== kind) {
    throw refuse(`A ${kind} cannot hold a ${parsed.data.kind}`)
  }
  return parsed.data
}

export function seedColumns(kind: PaperStoredKind, stored: unknown) {
  const upgraded = upgradeStoredPaper(kind, stored)
  if (!upgraded.ok) throw refuse(upgraded.message)
  let base: Uint8Array
  try {
    base = seedYDoc(upgraded.document)
  } catch (error) {
    throw refuse(error instanceof Error ? error.message : "Cannot seed")
  }
  const materialized = materialize(base)
  if (!materialized.ok) throw refuse(materialized.reason)
  return {
    crdtEpoch: FIRST_EPOCH,
    crdtBase: Buffer.from(base),
    crdtDocument: validated(materialized.document, kind) as unknown as Record<
      string,
      unknown
    >,
  }
}

async function lockedRow(userId: UserId, docId: PaperId): Promise<PaperRow> {
  const rows = await getDb()
    .select()
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .limit(1)
    .for("update")
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  return row
}

async function seeded(row: PaperRow): Promise<PaperRow> {
  if (row.crdtBase) return row
  const columns = seedColumns(row.kind, row.document)
  const patch = { ...columns, crdtBaseSeq: row.contentVersion }
  await getDb().update(paperDocs).set(patch).where(eq(paperDocs.id, row.id))
  return { ...row, ...patch }
}

async function loggedRows(docId: string, afterSeq: number): Promise<LogRow[]> {
  return getDb()
    .select({
      seq: paperDocUpdates.seq,
      origin: paperDocUpdates.origin,
      editId: paperDocUpdates.editId,
      basedOn: paperDocUpdates.basedOn,
      update: paperDocUpdates.update,
    })
    .from(paperDocUpdates)
    .where(
      and(eq(paperDocUpdates.paperId, docId), gt(paperDocUpdates.seq, afterSeq))
    )
    .orderBy(asc(paperDocUpdates.seq))
}

async function rowsFrom(docId: string, seq: number, inclusive: boolean) {
  return getDb()
    .select({ seq: paperDocUpdates.seq, update: paperDocUpdates.update })
    .from(paperDocUpdates)
    .where(
      and(
        eq(paperDocUpdates.paperId, docId),
        inclusive ? gte(paperDocUpdates.seq, seq) : gt(paperDocUpdates.seq, seq)
      )
    )
    .orderBy(asc(paperDocUpdates.seq))
}

function describe(
  row: PaperRow,
  base: Buffer
): Omit<Live, "yDoc" | "tip" | "revision"> {
  return {
    epoch: row.crdtEpoch ?? FIRST_EPOCH,
    baseSeq: row.crdtBaseSeq ?? row.contentVersion,
    base,
  }
}

async function freshLive(row: PaperRow, base: Buffer): Promise<Live> {
  const shape = describe(row, base)
  const logged = await rowsFrom(row.id, shape.baseSeq, false)
  logged.forEach((entry, index) => {
    if (entry.seq !== shape.baseSeq + index + 1) {
      throw new Error("The change log of this paper has a gap")
    }
  })
  const last = logged[logged.length - 1]
  const revision = last ? last.seq : shape.baseSeq
  if (revision !== row.contentVersion) {
    throw new Error("The change log of this paper does not match its version")
  }
  return {
    ...shape,
    yDoc: loadYDoc(
      base,
      logged.map((entry) => entry.update)
    ),
    revision,
    tip: last ? last.update : null,
  }
}

async function caughtUp(cached: Live, row: PaperRow, base: Buffer) {
  const shape = describe(row, base)
  if (
    cached.epoch !== shape.epoch ||
    cached.baseSeq !== shape.baseSeq ||
    !sameBytes(cached.base, base) ||
    cached.revision > row.contentVersion
  ) {
    return null
  }
  const newer = await rowsFrom(row.id, cached.revision, cached.tip !== null)
  const [first, ...rest] = newer
  let pending = newer
  if (cached.tip) {
    if (!first || first.seq !== cached.revision) return null
    if (!sameBytes(first.update, cached.tip)) return null
    pending = rest
  }
  let revision = cached.revision
  let tip = cached.tip
  for (const entry of pending) {
    if (entry.seq !== revision + 1) return null
    const absorbed = absorbUpdate(cached.yDoc, entry.update, "log")
    if (!absorbed.ok) return null
    revision = entry.seq
    tip = entry.update
  }
  if (revision !== row.contentVersion) return null
  cached.revision = revision
  cached.tip = tip
  return cached
}

async function hydrate(row: PaperRow): Promise<Live> {
  const base = row.crdtBase as Buffer
  const cached = live.get(row.id)
  if (cached) {
    const current = await caughtUp(cached, row, base).catch(() => null)
    if (current) {
      remember(row.id, current)
      return current
    }
    live.delete(row.id)
  }
  const entry = await freshLive(row, base)
  remember(row.id, entry)
  return entry
}

function legacyDocument(paper: PaperDocument, witness: unknown) {
  return legacyPaperOf(paper, witness) as unknown as Record<string, unknown>
}

async function commit(
  row: PaperRow,
  entry: Live,
  effective: Uint8Array,
  change: {
    origin: string
    editId?: string
    basedOn?: number
    witness: unknown
  }
): Promise<PaperRow> {
  const materialized = materialize(entry.yDoc)
  if (!materialized.ok) throw refuse(materialized.reason)
  const paper = validated(materialized.document, row.kind)
  const seq = entry.revision + 1
  const update = Buffer.from(effective)
  await getDb()
    .insert(paperDocUpdates)
    .values({
      paperId: row.id,
      seq,
      origin: change.origin,
      editId: change.editId ?? null,
      basedOn: change.basedOn ?? null,
      update,
    })
  const patch = {
    crdtDocument: paper as unknown as Record<string, unknown>,
    document: legacyDocument(paper, change.witness),
    contentVersion: seq,
    updatedAt: new Date(),
  }
  await getDb().update(paperDocs).set(patch).where(eq(paperDocs.id, row.id))
  entry.revision = seq
  entry.tip = update
  return { ...row, ...patch }
}

async function editLocked(
  row: PaperRow,
  entry: Live,
  change: ContentEdit
): Promise<PaperRow> {
  try {
    const current = validated(row.crdtDocument, row.kind)
    const target = validated(
      typeof change.target === "function"
        ? change.target(current)
        : change.target,
      row.kind
    )
    const witness = change.witness ?? row.document
    let effective: Uint8Array | null
    try {
      effective = writeDocument(entry.yDoc, target, change.origin)
    } catch (error) {
      throw refuse(error instanceof Error ? error.message : "Cannot write")
    }
    if (effective) {
      return await commit(row, entry, effective, { ...change, witness })
    }
    return row
  } catch (error) {
    live.delete(row.id)
    throw error
  }
}

async function appendLocked(
  row: PaperRow,
  entry: Live,
  change: Appended
): Promise<PaperRow | null> {
  try {
    const absorbed = absorbUpdate(entry.yDoc, change.update, change.origin)
    if (!absorbed.ok) throw refuse(absorbed.reason)
    const effective =
      absorbed.effective ?? (change.keepIfIneffective ? change.update : null)
    if (!effective) return null
    return await commit(row, entry, effective, {
      origin: change.origin,
      editId: change.editId,
      basedOn: change.basedOn,
      witness: row.document,
    })
  } catch (error) {
    live.delete(row.id)
    throw error
  }
}

export async function withContent<T>(
  userId: UserId,
  docId: PaperId,
  run: (content: LockedContent) => Promise<T>
): Promise<T> {
  return transaction(async () => {
    const row = await seeded(await lockedRow(userId, docId))
    const entry = await hydrate(row)
    let latest = row
    const content: LockedContent = {
      row,
      document: validated(row.crdtDocument, row.kind),
      baseSeq: entry.baseSeq,
      edit: async (change) => {
        latest = await editLocked(latest, entry, change)
        return latest
      },
      fork: async (basedOn) => {
        if (basedOn === entry.revision) return forkOf(entry.yDoc)
        const logged = await loggedRows(row.id, entry.baseSeq)
        return loadYDoc(
          entry.base,
          logged
            .filter((logRow) => logRow.seq <= basedOn)
            .map((logRow) => logRow.update)
        )
      },
      history: async () => ({
        base: entry.base,
        rows: await loggedRows(row.id, entry.baseSeq),
      }),
      append: (change) =>
        appendLocked(latest, entry, change).then((next) => {
          if (next) latest = next
          return next
        }),
    }
    return run(content)
  })
}

export async function syncContent(
  userId: UserId,
  docId: PaperId,
  request: SyncRequest
): Promise<SyncReply> {
  return transaction(async () => {
    let row = await seeded(await lockedRow(userId, docId))
    const entry = await hydrate(row)
    const reply = (reset: boolean, since: Uint8Array): SyncReply => {
      const update = updateSince(entry.yDoc, since)
      if (!update) throw refuse("The state vector could not be read")
      return {
        epoch: entry.epoch,
        revision: entry.revision,
        reset,
        update,
        stateVector: stateVectorOf(entry.yDoc),
      }
    }
    if (request.epoch !== NO_LOCAL_COPY && request.epoch !== entry.epoch) {
      return reply(true, new Uint8Array())
    }
    try {
      const absorbed =
        request.update.length === 0
          ? ({ ok: true, effective: null } as const)
          : absorbUpdate(entry.yDoc, request.update, "person")
      if (!absorbed.ok) throw refuse(absorbed.reason)
      if (absorbed.effective) {
        row = await commit(row, entry, absorbed.effective, {
          origin: "person",
          witness: row.document,
        })
      }
      return reply(false, request.stateVector)
    } catch (error) {
      live.delete(docId)
      throw error
    }
  })
}
