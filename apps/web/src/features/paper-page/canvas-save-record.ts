import { z } from "@workspace/domain"

import type { LocalObservation } from "@/lib/paper-package-ack.ts"
import type { DraftBasis } from "./canvas-edit.ts"
import type { PageBlock } from "./canvas-save-lines.ts"
import {
  branchKey,
  branchSchema,
  mirrorSent,
  readBranch,
  sentSchema,
  writerFor,
  type Recovery,
  type SentRecord,
  type WritingBranch,
} from "./canvas-branch.ts"

export type { SentRecord } from "./canvas-branch.ts"
const DATABASE = "opencv-writing"
const TABLE = "pages"
const recordSchema = z
  .object({
    key: z.string(),
    writerId: z.string().uuid(),
    docId: z.string().uuid(),
    commandId: z.string().uuid(),
    generation: z.number().int().positive(),
    words: z.string(),
    revision: z.string().uuid().nullable(),
    idempotencyKey: z.string().uuid(),
    sent: z.array(sentSchema),
    authorized: z.array(z.string().uuid()),
    snapshot: branchSchema,
  })
  .strict()
  .refine(
    (record) =>
      record.key === branchKey(record.docId, record.writerId) &&
      record.snapshot.writerId === record.writerId &&
      record.snapshot.docId === record.docId &&
      record.sent.every(
        (item) =>
          item.docId === record.docId &&
          record.authorized.includes(item.attemptId)
      )
  )
export type WritingRecord = z.infer<typeof recordSchema>

let opened: Promise<IDBDatabase> | null = null
function database() {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1)
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(TABLE))
        opening.result.createObjectStore(TABLE, { keyPath: "key" })
    }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error)
  })
  return opened
}
export async function closeRecordDb() {
  const current = opened
  opened = null
  if (current) (await current.catch(() => null))?.close()
}
async function updateRecord(
  docId: string,
  change: (existing: WritingRecord | undefined) => WritingRecord | null
) {
  const key = branchKey(docId)
  const db = await database()
  return new Promise<WritingRecord | null>((resolve, reject) => {
    const tx = db.transaction(TABLE, "readwrite")
    const store = tx.objectStore(TABLE)
    const req = store.get(key)
    let value: WritingRecord | null = null
    req.onsuccess = () => {
      const parsed = recordSchema.safeParse(req.result)
      if (req.result && !parsed.success) {
        tx.abort()
        return
      }
      try {
        value = change(parsed.success ? parsed.data : undefined)
        if (value) {
          value = recordSchema.parse({
            ...value,
            snapshot: {
              ...value.snapshot,
              sent: value.sent,
              snapshotId: crypto.randomUUID(),
            },
          })
          store.put(value)
        }
      } catch {
        tx.abort()
      }
    }
    tx.oncomplete = () => {
      if (value)
        mirrorSent(docId, value.sent, value.writerId, value.snapshot.snapshotId)
      resolve(value)
    }
    tx.onabort = () => reject(tx.error ?? new Error("aborted"))
    tx.onerror = () => reject(tx.error ?? new Error("failed"))
  })
}
function fresh(
  docId: string,
  words: string,
  blocks: readonly PageBlock[],
  basis: DraftBasis | null
): WritingRecord {
  const commandId = crypto.randomUUID()
  const writerId = writerFor(docId)
  let local: WritingBranch | null = null
  try {
    local = readBranch(docId, localStorage)
  } catch {
    local = null
  }
  const first = blocks[0]?.id ?? "p1"
  return {
    key: branchKey(docId),
    docId,
    writerId,
    commandId,
    generation: 1,
    words,
    revision: null,
    idempotencyKey: commandId,
    sent: [],
    authorized: [],
    snapshot: local
      ? {
          ...local,
          draft: {
            ...local.draft,
            blocks: blocks.slice(),
            caret: blocks.some(
              (item) =>
                item.id === local.draft.caret.blockId &&
                item.text.length >= local.draft.caret.offset
            )
              ? local.draft.caret
              : { blockId: first, offset: 0 },
          },
          basis,
        }
      : {
          version: 1,
          docId,
          writerId,
          snapshotId: crypto.randomUUID(),
          draft: {
            blocks: blocks.slice(),
            caret: { blockId: first, offset: 0 },
            nextId: blocks.length + 1,
          },
          basis,
          saved: null,
          unsaved: [],
          sent: [],
          dismissed: [],
        },
  }
}
export async function commitWords(
  docId: string,
  words: string,
  blocks: readonly PageBlock[] = [{ id: "p1", text: words }],
  basis: DraftBasis | null = null
): Promise<{ local: LocalObservation; record: WritingRecord }> {
  let record = fresh(docId, words, blocks, basis)
  try {
    const kept = await updateRecord(docId, (existing) => ({
      ...record,
      ...(existing
        ? {
            commandId: existing.commandId,
            idempotencyKey: existing.idempotencyKey,
            generation:
              existing.words === words
                ? existing.generation
                : existing.generation + 1,
            sent: existing.sent,
            authorized: existing.authorized,
          }
        : {}),
    }))
    if (!kept) throw new Error("not written")
    record = kept
    return {
      local: { transaction: "complete", generation: record.generation, words },
      record,
    }
  } catch {
    await closeRecordDb()
    return {
      local: { transaction: "aborted", generation: record.generation, words },
      record,
    }
  }
}
export async function pendingSent(docId: string): Promise<boolean> {
  try {
    const key = branchKey(docId)
    const db = await database()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(TABLE, "readonly")
      const request = tx.objectStore(TABLE).get(key)
      tx.oncomplete = () => {
        const parsed = recordSchema.safeParse(request.result)
        resolve(
          key === branchKey(docId) &&
            parsed.success &&
            parsed.data.sent.some(
              (item) =>
                parsed.data.authorized.includes(item.attemptId) &&
                item.docId === docId &&
                !item.receipt &&
                !item.refused
            )
        )
      }
      tx.onabort = () => reject(tx.error)
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    return false
  }
}
export function ownSent(
  record: WritingRecord,
  claimed: DraftBasis | null,
  revision: string,
  seen: string
): SentRecord | undefined {
  if (!claimed?.revision) return undefined
  return record.sent.findLast(
    (item) =>
      record.authorized.includes(item.attemptId) &&
      item.docId === record.docId &&
      item.bases.includes(claimed.revision ?? "") &&
      item.receipt?.docId === record.docId &&
      item.receipt.revision === revision &&
      item.words === seen &&
      !item.refused
  )
}
export async function keepSent(
  docId: string,
  keep: (sent: readonly SentRecord[]) => SentRecord[]
) {
  return updateRecord(docId, (existing) =>
    existing ? { ...existing, sent: keep(existing.sent) } : null
  )
}
export async function recordSent(
  docId: string,
  given: Pick<SentRecord, "input" | "words" | "blocks" | "bases">
): Promise<SentRecord> {
  const attemptId = crypto.randomUUID()
  const written = await updateRecord(docId, (existing) => {
    if (!existing) return null
    const sent = sentSchema.parse({
      ...given,
      writerId: existing.writerId,
      docId,
      attemptId,
      idempotencyKey: attemptId,
      generation: existing.generation,
      receipt: null,
      refused: false,
    })
    return {
      ...existing,
      sent: [...existing.sent, sent],
      authorized: [...existing.authorized, attemptId],
    }
  })
  const sent = written?.sent.find((item) => item.attemptId === attemptId)
  if (!sent)
    throw new Error("The original save could not be kept on this computer.")
  return sent
}
export async function answerSent(
  docId: string,
  attempt: SentRecord,
  receipt: SentRecord["receipt"],
  refused = false
) {
  return updateRecord(docId, (existing) =>
    existing
      ? {
          ...existing,
          sent: existing.sent.map((item) =>
            item.attemptId === attempt.attemptId &&
            item.idempotencyKey === attempt.idempotencyKey &&
            JSON.stringify(item.input) === JSON.stringify(attempt.input)
              ? { ...item, receipt, refused }
              : item
          ),
        }
      : null
  )
}
export async function importSent(docId: string, snapshot: WritingBranch) {
  return updateRecord(docId, (existing) =>
    existing
      ? {
          ...existing,
          sent: snapshot.sent,
          authorized: snapshot.sent.map((item) => item.attemptId),
        }
      : null
  )
}
const legacyRecordSchema = z
  .object({
    key: z.string().uuid(),
    commandId: z.string().uuid(),
    generation: z.number().int().positive(),
    words: z.string(),
    revision: z.string().uuid().nullable(),
    idempotencyKey: z.string().uuid(),
    sent: z
      .array(
        z
          .object({
            words: z.string(),
            bases: z.array(z.string().uuid()),
            blocks: z.array(z.object({ id: z.string(), text: z.string() })),
          })
          .strict()
      )
      .optional(),
  })
  .strict()
export async function recoveryRecords(
  docId: string
): Promise<{ drafts: Recovery[]; unreadable: boolean }> {
  try {
    const db = await database()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(TABLE, "readonly")
      const req = tx.objectStore(TABLE).getAll()
      req.onsuccess = () => {
        const drafts: Recovery[] = []
        let unreadable = false
        for (const raw of req.result) {
          const result = recordSchema.safeParse(raw)
          if (result.success) {
            const branch = result.data.snapshot
            if (branch.docId !== docId || branch.writerId === writerFor(docId))
              continue
            const key = branchKey(docId, branch.writerId)
            drafts.push({
              key,
              identity: `${key}:${branch.snapshotId}`,
              branch,
              legacy: false,
            })
            continue
          }
          const keyResult = z.object({ key: z.string() }).safeParse(raw)
          if (
            !keyResult.success ||
            (keyResult.data.key !== docId &&
              !keyResult.data.key.startsWith(`opencv-writing:${docId}:`))
          )
            continue
          const legacy = legacyRecordSchema.safeParse(raw)
          if (!legacy.success || legacy.data.key !== docId) {
            unreadable = true
            continue
          }
          const key = `indexeddb:opencv-writing:${docId}`
          const record = legacy.data
          drafts.push({
            key,
            identity: `${key}:${JSON.stringify(raw)}`,
            legacy: true,
            branch: {
              version: 1,
              docId,
              writerId: record.commandId,
              snapshotId: record.idempotencyKey,
              draft: {
                blocks: [{ id: "legacy", text: record.words }],
                caret: { blockId: "legacy", offset: 0 },
                nextId: 2,
              },
              basis: null,
              saved: null,
              unsaved: [],
              sent: [],
              dismissed: [],
            },
          })
        }
        resolve({ drafts, unreadable })
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return { drafts: [], unreadable: true }
  }
}
