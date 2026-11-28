import {
  ERROR_CODES,
  parsePaperId,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import { absorbUpdate, forkOf, loadYDoc } from "@workspace/paper-crdt"
import { and, asc, eq, gte, gt } from "drizzle-orm"

import { getDb, ownedTaskTransaction } from "../../db/context.js"
import { paperDocUpdates, paperDocs } from "../../db/schema.js"
import { CommandError } from "../../platform/errors.js"

import {
  qualifyRichDocument,
  qualifyRichSnapshot,
  type RichSnapshot,
  type RichSnapshotInput,
} from "./rich-snapshot.js"

export { seedColumns } from "./content-document.js"

import type { PaperRow, Live } from "./content-types.js"
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

const live = new Map<string, Live>()

function detached(entry: Live): Live {
  return { ...entry, yDoc: forkOf(entry.yDoc) }
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
