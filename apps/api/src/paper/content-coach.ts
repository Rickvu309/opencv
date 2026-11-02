import {
  applyPaperEdits,
  ERROR_CODES,
  paperChanges,
  paperDocumentSchema,
  type PaperChange,
  type PaperDocument,
  type PaperEdit,
  type PaperEditOutcome,
  type PaperId,
  type PaperStoredKind,
  type UserId,
} from "@workspace/domain"
import {
  emptyUpdate,
  materialize,
  revertOrigin,
  writeDocument,
  type HistoryRow,
  type PaperYDoc,
} from "@workspace/paper-crdt"

import { CommandError } from "../registry/errors.js"
import {
  withContent,
  type LockedContent,
  type LogRow,
} from "./content-store.js"

export type CoachEditInput = {
  readonly basedOn: number
  readonly edits: readonly PaperEdit[]
  readonly editId: string
  readonly newId: () => string
}

export type CoachEditResult = {
  readonly docId: PaperId
  readonly name: string
  readonly kind: PaperStoredKind
  readonly revision: number
  readonly editId: string | null
  readonly outcomes: PaperEditOutcome[]
  readonly changes: PaperChange[]
}

type CoachRevertResult = {
  readonly revision: number
  readonly reverted: boolean
}

const coachOrigin = (editId: string) => `coach:${editId}`

function conflict(message: string) {
  return new CommandError(ERROR_CODES.CONFLICT, message)
}

function forkDocument(fork: PaperYDoc, kind: PaperStoredKind): PaperDocument {
  const materialized = materialize(fork)
  if (!materialized.ok) throw conflict(materialized.reason)
  const parsed = paperDocumentSchema.safeParse(materialized.document)
  if (!parsed.success || parsed.data.kind !== kind) {
    throw conflict("The document you read cannot be rebuilt")
  }
  return parsed.data
}

function checkedBasis(content: LockedContent, basedOn: number) {
  const revision = content.row.contentVersion
  if (basedOn > revision) {
    throw conflict(
      `basedOn ${basedOn} is ahead of revision ${revision}. Read paper.outline again`
    )
  }
  if (basedOn < content.baseSeq) {
    throw conflict(
      `basedOn ${basedOn} is older than this document's history. Read paper.outline again`
    )
  }
}

export async function editAsCoach(
  userId: UserId,
  docId: PaperId,
  input: CoachEditInput
): Promise<CoachEditResult> {
  return withContent(userId, docId, async (content) => {
    checkedBasis(content, input.basedOn)
    const { row } = content
    const fork = await content.fork(input.basedOn)
    const base = forkDocument(fork, row.kind)
    const applied = applyPaperEdits(
      base,
      content.document,
      input.edits,
      input.newId
    )
    const result = (
      editId: string | null,
      revision: number,
      changes: PaperChange[]
    ): CoachEditResult => ({
      docId,
      name: row.name,
      kind: row.kind,
      revision,
      editId,
      outcomes: applied.outcomes,
      changes,
    })
    if (applied.applied === 0) return result(null, row.contentVersion, [])
    const update = writeDocument(
      fork,
      applied.target,
      coachOrigin(input.editId)
    )
    const written = update
      ? await content.append({
          origin: "coach",
          editId: input.editId,
          basedOn: input.basedOn,
          update,
        })
      : null
    if (!written) return result(null, row.contentVersion, [])
    return result(
      input.editId,
      written.contentVersion,
      paperChanges(base, applied.target)
    )
  })
}

function historyOf(base: Uint8Array, rows: readonly LogRow[]): HistoryRow[] {
  return [
    { update: base, origin: "seed" },
    ...rows.map((row) => ({
      update: row.update,
      origin: originOf(row),
    })),
  ]
}

function originOf(row: LogRow): string {
  if (row.origin === "coach" && row.editId) return coachOrigin(row.editId)
  if (row.origin === "revert" && row.editId) {
    return `revert:${coachOrigin(row.editId)}`
  }
  return row.origin
}

function newerCoachEdit(rows: readonly LogRow[], target: LogRow) {
  const reverted = new Set(
    rows.filter((row) => row.origin === "revert").map((row) => row.editId)
  )
  return rows.find(
    (row) =>
      row.origin === "coach" &&
      row.seq > target.seq &&
      row.editId !== target.editId &&
      !reverted.has(row.editId) &&
      (row.basedOn ?? 0) >= target.seq
  )
}

export async function revertCoachEdit(
  userId: UserId,
  docId: PaperId,
  editId: string
): Promise<CoachRevertResult> {
  return withContent(userId, docId, async (content) => {
    const { base, rows } = await content.history()
    const target = rows.find(
      (row) => row.origin === "coach" && row.editId === editId
    )
    if (!target) {
      throw new CommandError(
        ERROR_CODES.NOT_FOUND,
        "That Coach edit is not in this document's history"
      )
    }
    const alreadyReverted = rows.some(
      (row) => row.origin === "revert" && row.editId === editId
    )
    if (alreadyReverted) {
      return { revision: content.row.contentVersion, reverted: false }
    }
    if (newerCoachEdit(rows, target)) {
      throw conflict(
        "Undo the newer Coach edit first. It was made on top of this one."
      )
    }
    const update = revertOrigin(historyOf(base, rows), coachOrigin(editId))
    const written = await content.append({
      origin: "revert",
      editId,
      update: update ?? emptyUpdate(),
      keepIfIneffective: true,
    })
    return {
      revision: written?.contentVersion ?? content.row.contentVersion,
      reverted: update !== null,
    }
  })
}
