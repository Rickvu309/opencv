import { z } from "@workspace/domain/kernel"
import {
  paperCanvasCommitSchema,
  type PaperCanvasCommit,
} from "@workspace/domain/paper-doc"

import type { DraftBasis, WritingDraft } from "./canvas-edit.ts"
import type { LineRefusal } from "./canvas-save-lines.ts"

type WriteInput = Extract<PaperCanvasCommit, { op: "write" }>

const uuid = z.string().uuid()
const block = z.object({
  id: z.string().min(1),
  text: z.string(),
  held: z.boolean().optional(),
  reason: z.string().optional(),
})
export const draftSchema = z
  .object({
    blocks: z.array(block).min(1),
    caret: z
      .object({ blockId: z.string(), offset: z.number().int().nonnegative() })
      .strict(),
    nextId: z.number().int().positive(),
  })
  .refine(
    (draft) =>
      new Set(draft.blocks.map((item) => item.id)).size ===
        draft.blocks.length &&
      draft.blocks.some(
        (item) =>
          item.id === draft.caret.blockId &&
          draft.caret.offset <= item.text.length
      )
  )
const basisSchema = z
  .object({ revision: uuid.nullable(), words: z.string() })
  .strict()
const refusalSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    note: z.string(),
    removed: z.literal(true).optional(),
  })
  .strict()
export const sentSchema = z
  .object({
    writerId: uuid,
    attemptId: uuid,
    docId: uuid,
    generation: z.number().int().positive(),
    input: z.custom<WriteInput>((value) => {
      const parsed = paperCanvasCommitSchema.safeParse(value)
      return parsed.success && parsed.data.op === "write"
    }),
    idempotencyKey: uuid,
    words: z.string(),
    bases: z.array(uuid),
    blocks: z.array(block).min(1),
    receipt: z
      .object({
        generation: z.literal("package"),
        docId: uuid,
        revision: uuid,
        activityId: uuid.optional(),
      })
      .strict()
      .nullable(),
    refused: z.boolean(),
  })
  .strict()
  .refine(
    (item) =>
      item.attemptId === item.idempotencyKey &&
      item.input.batch.doc === item.docId &&
      item.bases.includes(item.input.batch.basedOn) &&
      item.words === item.blocks.map((line) => line.text).join("\n") &&
      (!item.receipt || item.receipt.docId === item.docId)
  )
export type SentRecord = z.infer<typeof sentSchema>

export const branchSchema = z
  .object({
    version: z.literal(1),
    docId: uuid,
    writerId: uuid,
    snapshotId: uuid,
    draft: draftSchema,
    basis: basisSchema.nullable(),
    saved: draftSchema.nullable(),
    unsaved: z.array(refusalSchema),
    sent: z.array(sentSchema),
    dismissed: z.array(z.string()),
  })
  .strict()
  .refine(
    (branch) =>
      branch.sent.every((item) => item.docId === branch.docId) &&
      new Set(branch.sent.map((item) => item.attemptId)).size ===
        branch.sent.length
  )
export type WritingBranch = z.infer<typeof branchSchema>
export type Recovery = {
  identity: string
  key: string
  branch: WritingBranch
  legacy: boolean
}

const writers = new Map<string, string>()
export function writerFor(docId: string) {
  let writer = writers.get(docId)
  if (!writer) {
    writer = crypto.randomUUID()
    writers.set(docId, writer)
  }
  return writer
}
export function rotateWriter(docId: string) {
  writers.set(docId, crypto.randomUUID())
}
export function branchKey(docId: string, writerId = writerFor(docId)) {
  return `opencv-writing:${docId}:${writerId}`
}
export function parseBranch(
  raw: string | null,
  docId: string,
  key: string
): WritingBranch | null {
  if (!raw) return null
  try {
    const parsed = branchSchema.safeParse(JSON.parse(raw))
    return parsed.success &&
      parsed.data.docId === docId &&
      key === branchKey(docId, parsed.data.writerId)
      ? parsed.data
      : null
  } catch {
    return null
  }
}
export function readBranch(
  docId: string,
  storage: Pick<Storage, "getItem">
): WritingBranch | null {
  try {
    const key = branchKey(docId)
    return parseBranch(storage.getItem(key), docId, key)
  } catch {
    return null
  }
}
export function writeBranch(
  docId: string,
  draft: WritingDraft,
  basis: DraftBasis | null,
  kept: { saved?: WritingDraft | null; unsaved?: readonly LineRefusal[] },
  storage: Pick<Storage, "getItem" | "setItem"> = writingStorage
) {
  try {
    const key = branchKey(docId)
    const raw = storage.getItem(key)
    const before = parseBranch(raw, docId, key)
    if (raw && !before) return false
    const branch = branchSchema.parse({
      version: 1,
      docId,
      writerId: writerFor(docId),
      snapshotId: crypto.randomUUID(),
      draft,
      basis,
      saved: kept.saved ?? null,
      unsaved: kept.unsaved ?? [],
      sent: before?.sent ?? [],
      dismissed: before?.dismissed ?? [],
    })
    storage.setItem(key, JSON.stringify(branch))
    return true
  } catch {
    return false
  }
}
export function mirrorSent(
  docId: string,
  sent: readonly SentRecord[],
  writerId: string,
  snapshotId: string
) {
  try {
    const key = branchKey(docId, writerId)
    const branch = parseBranch(writingStorage.getItem(key), docId, key)
    if (branch)
      writingStorage.setItem(
        key,
        JSON.stringify({ ...branch, sent, snapshotId })
      )
  } catch {
    return
  }
}
export function recoveries(
  docId: string,
  storage: Storage = writingStorage
): { drafts: Recovery[]; unreadable: boolean } {
  const drafts: Recovery[] = []
  let unreadable = false
  try {
    const own = readBranch(docId, storage)
    const prefix = `opencv-writing:${docId}`
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (
        !key ||
        key === branchKey(docId) ||
        (key !== prefix && !key.startsWith(`${prefix}:`))
      )
        continue
      const raw = storage.getItem(key)
      if (!raw) continue
      const branch = parseBranch(raw, docId, key)
      if (branch) {
        const identity = `${key}:${branch.snapshotId}`
        if (
          !own?.dismissed.includes(identity) &&
          (!branch.basis ||
            branch.draft.blocks.map((item) => item.text).join("\n") !==
              branch.basis.words ||
            branch.unsaved.length > 0)
        )
          drafts.push({ identity, key, branch, legacy: false })
        continue
      }
      if (key !== prefix) {
        unreadable = true
        continue
      }
      let value: unknown
      try {
        value = JSON.parse(raw)
      } catch {
        unreadable = true
        continue
      }
      const wrapped = z
        .object({
          draft: draftSchema,
          basis: basisSchema.nullable().optional(),
          saved: draftSchema.nullable().optional(),
          unsaved: z.array(refusalSchema).optional(),
        })
        .safeParse(value)
      const plain = draftSchema.safeParse(value)
      const legacy = wrapped.success
        ? wrapped.data.draft
        : plain.success
          ? plain.data
          : null
      if (!legacy) {
        unreadable = true
        continue
      }
      const identity = `${key}:${raw}`
      if (!own?.dismissed.includes(identity))
        drafts.push({
          identity,
          key,
          legacy: true,
          branch: {
            version: 1,
            docId,
            writerId: crypto.randomUUID(),
            snapshotId: crypto.randomUUID(),
            draft: legacy,
            basis: wrapped.success ? (wrapped.data.basis ?? null) : null,
            saved: wrapped.success ? (wrapped.data.saved ?? null) : null,
            unsaved: wrapped.success ? (wrapped.data.unsaved ?? []) : [],
            sent: [],
            dismissed: [],
          },
        })
    }
  } catch {
    unreadable = true
  }
  return { drafts, unreadable }
}
export function dismissRecovery(docId: string, identity: string) {
  try {
    const current = readBranch(docId, writingStorage)
    if (!current) return false
    writingStorage.setItem(
      branchKey(docId),
      JSON.stringify({
        ...current,
        snapshotId: crypto.randomUUID(),
        dismissed: [...new Set([...current.dismissed, identity])],
      })
    )
    return true
  } catch {
    return false
  }
}

export const writingStorage: Storage = {
  get length() {
    return globalThis.localStorage.length
  },
  key(index) {
    return globalThis.localStorage.key(index)
  },
  getItem(key) {
    return globalThis.localStorage.getItem(key)
  },
  setItem(key, value) {
    globalThis.localStorage.setItem(key, value)
  },
  removeItem(key) {
    globalThis.localStorage.removeItem(key)
  },
  clear() {
    throw new Error("Writing branches must be kept separately.")
  },
}
