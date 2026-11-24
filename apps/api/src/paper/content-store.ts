import {
  ERROR_CODES,
  parsePaperId,
  canonicalPaper,
  nativeProvenance,
  sameNativeProvenance,
  type NativeWriter,
  type NativeBasis,
  nodeFingerprint,
  repairPaper,
  paperDocumentSchema,
  type PaperId,
  type UserId,
} from "@workspace/domain"
import {
  absorbUpdate,
  aliveCharacters,
  forkOf,
  carriesChange,
  knownAfter,
  materializeCandidate,
  twinFlags,
  writeRepair,
  mergedUpdate,
  lostCharacters,
  loadYDoc,
  materialize,
  materializeStored,
  stateVectorOf,
  updateSince,
  writeDocument,
} from "@workspace/paper-crdt"
import { and, asc, eq, gte, gt } from "drizzle-orm"

import {
  getDb,
  insideTransaction,
  transaction,
  ownedTaskTransaction,
} from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import {
  COMPACT_EVERY_SEQ,
  droppedPhotoIds,
  foldSettledLog,
} from "./content-compact.js"

import {
  validated,
  validatedStored,
  sameDocumentIdentity,
} from "./content-document.js"
import { admitBasis, admitDocument } from "./native-admission.js"
import {
  qualifyRichDocument,
  qualifyRichSnapshot,
  type RichSnapshot,
  type RichSnapshotInput,
} from "./rich-snapshot.js"

export { seedColumns } from "./content-document.js"

import type {
  PaperRow,
  Live,
  ContentEdit,
  LogRow,
  Appended,
  AppendResult,
  LockedContent,
  SyncRequest,
  SyncReply,
} from "./content-types.js"
export type {
  ContentEdit,
  LogRow,
  Appended,
  AppendResult,
  LockedContent,
  SyncRequest,
  SyncReply,
} from "./content-types.js"

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

function detached(entry: Live): Live {
  return { ...entry, yDoc: forkOf(entry.yDoc) }
}

async function withLiveTransaction<T>(
  run: (retain: (docId: string, entry: Live) => void) => Promise<T>
): Promise<T> {
  const committed: { head?: { docId: string; entry: Live } } = {}
  const result = await transaction(() =>
    run((docId, entry) => {
      committed.head = { docId, entry }
    })
  )
  if (committed.head && !insideTransaction()) {
    remember(committed.head.docId, committed.head.entry)
  }
  return result
}

function refuse(message: string) {
  return new CommandError(ERROR_CODES.VALIDATION_ERROR, message)
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return Buffer.from(a).equals(Buffer.from(b))
}

export function cacheRevisionUsable(
  cachedRevision: number,
  contentVersion: number
) {
  return cachedRevision <= contentVersion
}

export function nextContentSeq(entryRevision: number) {
  return entryRevision + 1
}

export function sameContentVersion(current: number, sent: number) {
  return current === sent
}

export function coachBasisOk(
  basedOn: number,
  revision: number,
  baseSeq: number
) {
  return basedOn <= revision && basedOn >= baseSeq
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

async function loggedRows(docId: string, afterSeq: number): Promise<LogRow[]> {
  return getDb()
    .select({
      seq: paperDocUpdates.seq,
      origin: paperDocUpdates.origin,
      editId: paperDocUpdates.editId,
      basedOn: paperDocUpdates.basedOn,
      touched: paperDocUpdates.touched,
      rebuilt: paperDocUpdates.rebuilt,
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
    !cacheRevisionUsable(cached.revision, row.contentVersion)
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
    const current = await caughtUp(detached(cached), row, base).catch(
      () => null
    )
    if (current) {
      return current
    }
    live.delete(row.id)
  }
  return freshLive(row, base)
}

async function commit(
  row: PaperRow,
  entry: Live,
  effective: Uint8Array,
  change: {
    origin: string
    editId?: string
    basedOn?: number
    touched?: string[]
    rebuilt?: string[]
  }
): Promise<PaperRow> {
  const materialized = materializeStored(entry.yDoc)
  if (!materialized.ok) throw refuse(materialized.reason)
  const paper = validatedStored(materialized.document, row.kind)
  sameDocumentIdentity(validatedStored(row.crdtDocument, row.kind), paper)
  const seq = nextContentSeq(entry.revision)
  const update = Buffer.from(effective)
  await getDb()
    .insert(paperDocUpdates)
    .values({
      paperId: row.id,
      seq,
      origin: change.origin,
      editId: change.editId ?? null,
      basedOn: change.basedOn ?? null,
      touched: change.touched ?? null,
      rebuilt: change.rebuilt ?? null,
      update,
      releasedPhotoRefs: droppedPhotoIds(row.crdtDocument, paper),
    })
  const patch = {
    crdtDocument: paper as unknown as Record<string, unknown>,
    contentVersion: seq,
    updatedAt: new Date(),
  }
  await getDb().update(paperDocs).set(patch).where(eq(paperDocs.id, row.id))
  if (seq % COMPACT_EVERY_SEQ === 0) {
    const folded = await foldSettledLog(row.id, entry)
    if (folded) {
      entry.base = folded.base
      entry.baseSeq = folded.baseSeq
    }
  }
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
    let effective: Uint8Array | null
    try {
      effective = writeDocument(entry.yDoc, target, change.origin)
    } catch (error) {
      throw refuse(error instanceof Error ? error.message : "Cannot write")
    }
    if (effective) {
      return await commit(row, entry, effective, change)
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
): Promise<AppendResult> {
  try {
    const protectedBefore = change.protect
      ? aliveCharacters(entry.yDoc, change.protect)
      : null
    const absorbed = absorbUpdate(entry.yDoc, change.update, change.origin)
    if (!absorbed.ok) throw refuse(absorbed.reason)
    if (
      protectedBefore &&
      lostCharacters(entry.yDoc, protectedBefore).length > 0
    ) {
      live.delete(row.id)
      return {
        row: null,
        problems: ["Text you typed in this document would be lost"],
      }
    }
    let touched: string[] | undefined
    let rebuilt: string[] | undefined
    if (
      change.check ||
      typeof change.touched === "function" ||
      typeof change.rebuilt === "function"
    ) {
      const materialized = materialize(entry.yDoc)
      if (!materialized.ok) {
        live.delete(row.id)
        return {
          row: null,
          problems: [
            `The merged document would break a rule: ${materialized.reason}`,
          ],
        }
      }
      const merged = validated(materialized.document, row.kind)
      const problems = change.check ? change.check(merged) : []
      if (problems.length > 0) {
        live.delete(row.id)
        return { row: null, problems }
      }
      if (typeof change.touched === "function") touched = change.touched(merged)
      if (typeof change.rebuilt === "function") rebuilt = change.rebuilt(merged)
    }
    if (Array.isArray(change.touched)) touched = change.touched
    if (Array.isArray(change.rebuilt)) rebuilt = change.rebuilt
    const effective =
      absorbed.effective ?? (change.keepIfIneffective ? change.update : null)
    if (!effective) return { row: null, problems: [] }
    const written = await commit(row, entry, effective, {
      origin: change.origin,
      editId: change.editId,
      basedOn: change.basedOn,
      touched,
      rebuilt,
    })
    return { row: written, problems: [] }
  } catch (error) {
    live.delete(row.id)
    throw error
  }
}

export async function withContent<T>(
  userId: UserId,
  docId: PaperId,
  run: (content: LockedContent) => Promise<T>,
  admission?: { writer?: NativeWriter; basis?: NativeBasis; proposal?: boolean }
): Promise<T> {
  return withLiveTransaction(async (retain) => {
    const row = await lockedRow(userId, docId)
    const document = validated(row.crdtDocument, row.kind)
    admitDocument(document, admission?.writer)
    if (admission?.proposal || admission?.basis)
      admitBasis(
        document,
        row.crdtEpoch ?? FIRST_EPOCH,
        row.contentVersion,
        admission?.basis
      )
    let entry = await hydrate(row)
    let latest = row
    const content: LockedContent = {
      row,
      document: validated(row.crdtDocument, row.kind),
      baseSeq: entry.baseSeq,
      edit: async (change) => {
        const candidate = detached(entry)
        const next = await editLocked(latest, candidate, change)
        entry = candidate
        latest = next
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
      append: async (change) => {
        const candidate = detached(entry)
        const next = await appendLocked(latest, candidate, change)
        if (next.row) {
          entry = candidate
          latest = next.row
        }
        return next
      },
    }
    const result = await run(content)
    retain(row.id, entry)
    return result
  })
}

async function staleCopies(
  row: PaperRow,
  entry: Live,
  ids: readonly string[]
): Promise<Map<string, string>> {
  const logged = await loggedRows(row.id, entry.baseSeq)
  const stale = new Map<string, string>()
  for (const id of ids) {
    const rebuilder = [...logged]
      .reverse()
      .find(
        (item) =>
          (item.origin === "coach" || item.origin === "revert") &&
          item.rebuilt?.includes(id)
      )
    if (!rebuilder) continue
    const before = materialize(
      loadYDoc(
        entry.base,
        logged
          .filter((item) => item.seq < rebuilder.seq)
          .map((item) => item.update)
      )
    )
    const fingerprint = before.ok ? nodeFingerprint(before.document, id) : null
    if (fingerprint) stale.set(id, fingerprint)
  }
  return stale
}

type Mended = { effective: Uint8Array | null; rebuilt?: string[] }

async function mended(
  row: PaperRow,
  entry: Live,
  request: SyncRequest,
  effective: Uint8Array | null
): Promise<Mended> {
  if (!effective) return { effective }
  const previous = validatedStored(row.crdtDocument, row.kind)
  if (previous.version === 4 && previous.schemaRevision === 2) {
    const candidate = materializeStored(entry.yDoc)
    if (!candidate.ok) throw refuse(candidate.reason)
    sameDocumentIdentity(previous, candidate.document)
    return { effective }
  }
  const read = materializeCandidate(entry.yDoc)
  if (!read.ok) {
    console.error(`[paper] cannot read ${row.id} after a sync: ${read.reason}`)
    return { effective }
  }
  if (!read.repaired && paperDocumentSchema.safeParse(read.candidate).success) {
    return { effective }
  }
  const fresh = twinFlags(entry.yDoc, request.update)
  const stale = await staleCopies(row, entry, [...fresh.keys()])
  const fixed = repairPaper(
    validated(row.crdtDocument, row.kind),
    read.candidate,
    {
      fresh,
      stale,
    }
  )
  if (!fixed) {
    console.error(`[paper] could not repair ${row.id} after a sync`)
    return { effective }
  }
  const update = writeRepair(
    forkOf(entry.yDoc),
    fixed.document,
    "server",
    fixed.moved,
    fixed.keep
  )
  if (!update) return { effective }
  const absorbed = absorbUpdate(entry.yDoc, update, "server")
  if (!absorbed.ok) throw refuse(absorbed.reason)
  return {
    effective: absorbed.effective
      ? mergedUpdate([effective, absorbed.effective])
      : effective,
    rebuilt: [...fixed.keep.keys(), ...fixed.moved],
  }
}

export async function syncContent(
  userId: UserId,
  docId: PaperId,
  request: SyncRequest
): Promise<SyncReply> {
  return withLiveTransaction(async (retain) => {
    let row = await lockedRow(userId, docId)
    const document = validatedStored(row.crdtDocument, row.kind)
    admitDocument(document, request.writer)
    const provenance =
      document.version === 4 ? nativeProvenance(document) : undefined
    if (!sameNativeProvenance(provenance, request.provenance))
      throw refuse(
        "The update belongs to a different document schema. Nothing was acknowledged or changed."
      )
    if (
      document.version === 4 &&
      request.epoch === NO_LOCAL_COPY &&
      carriesChange(request.update)
    )
      throw refuse(
        "An unbased native update cannot be admitted. Recover its original local basis first."
      )
    const entry = await hydrate(row)
    if (document.version === 4 && document.schemaRevision === 2) {
      const stored = materializeStored(entry.yDoc)
      if (!stored.ok) throw refuse(stored.reason)
      if (canonicalPaper(stored.document) !== canonicalPaper(document))
        throw refuse(
          "The rich document cache does not match its canonical content. Nothing was acknowledged or changed."
        )
    }
    const reply = (
      reset: boolean,
      since: Uint8Array,
      stale = false
    ): SyncReply => {
      const update = updateSince(entry.yDoc, since)
      if (!update) throw refuse("The state vector could not be read")
      retain(row.id, entry)
      return {
        ...(provenance ? { provenance } : {}),
        epoch: entry.epoch,
        revision: entry.revision,
        reset,
        stale,
        update,
        stateVector: stateVectorOf(entry.yDoc),
      }
    }
    if (request.epoch !== NO_LOCAL_COPY && request.epoch !== entry.epoch) {
      return reply(true, new Uint8Array())
    }
    if (request.basedOn === undefined && carriesChange(request.update)) {
      throw refuse("A push must say which revision it is based on")
    }
    if (request.basedOn !== undefined && entry.revision !== request.basedOn) {
      return reply(false, request.stateVector, true)
    }
    try {
      const absorbed =
        request.update.length === 0
          ? ({ ok: true, effective: null } as const)
          : absorbUpdate(entry.yDoc, request.update, "person")
      if (!absorbed.ok) throw refuse(absorbed.reason)
      const fixed = await mended(row, entry, request, absorbed.effective)
      if (fixed.effective) {
        row = await commit(row, entry, fixed.effective, {
          origin: "person",
          rebuilt: fixed.rebuilt,
        })
      }
      const after = knownAfter(request.stateVector, request.update)
      if (!after) throw refuse("The update could not be read")
      return reply(false, after)
    } catch (error) {
      live.delete(docId)
      throw error
    }
  })
}

export async function withRichSnapshot<T>(
  userId: UserId,
  input: RichSnapshotInput,
  run: (snapshot: RichSnapshot) => Promise<T>
): Promise<T> {
  return ownedTaskTransaction(async () => {
    const row = await lockedRow(userId, parsePaperId(input.docId))
    const document = qualifyRichDocument(row, input)
    const entry = await hydrate(row)
    try {
      return await run(qualifyRichSnapshot({ row, entry, input, document }))
    } finally {
      entry.yDoc.destroy()
    }
  })
}
