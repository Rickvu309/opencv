import {
  applyPaperEdits,
  effectsMissing,
  ERROR_CODES,
  paperChanges,
  paperDocumentSchema,
  personWorkLost,
  undoCoachEdit,
  undoProblems,
  type PaperChange,
  type PaperDocument,
  type PaperEdit,
  type PaperEditOutcome,
  type PaperId,
  type PaperStoredKind,
  type UserId,
} from "@workspace/domain"
import {
  absorbUpdate,
  emptyUpdate,
  loadYDoc,
  materialize,
  writeDocument,
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

type CoachRecord = {
  readonly editId: string
  readonly seq: number
  readonly basedOn: number
  readonly blocks: ReadonlySet<string>
  readonly pre: PaperDocument
  readonly post: PaperDocument
}

const coachOrigin = (editId: string) => `coach:${editId}`

function conflict(message: string) {
  return new CommandError(ERROR_CODES.CONFLICT, message)
}

function documentOf(yDoc: PaperYDoc, kind: PaperStoredKind): PaperDocument {
  const materialized = materialize(yDoc)
  if (!materialized.ok) throw conflict(materialized.reason)
  const parsed = paperDocumentSchema.safeParse(materialized.document)
  if (!parsed.success || parsed.data.kind !== kind) {
    throw conflict("The document cannot be rebuilt from its history")
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

async function coachRecords(
  content: LockedContent
): Promise<{ records: CoachRecord[]; rows: LogRow[] }> {
  const { base, rows } = await content.history()
  const replay = loadYDoc(base, [])
  const records: CoachRecord[] = []
  for (const row of rows) {
    const isCoach = row.origin === "coach" && row.editId
    const pre = isCoach ? documentOf(replay, content.row.kind) : null
    absorbUpdate(replay, row.update, "log")
    if (pre && row.editId) {
      const post = documentOf(replay, content.row.kind)
      records.push({
        editId: row.editId,
        seq: row.seq,
        basedOn: row.basedOn ?? 0,
        blocks: new Set(
          paperChanges(pre, post).map((change) => change.blockId)
        ),
        pre,
        post,
      })
    }
  }
  return { records, rows }
}

function blockedBy(
  records: readonly CoachRecord[],
  rows: readonly LogRow[],
  target: CoachRecord
): CoachRecord | undefined {
  const reverted = new Set(
    rows.filter((row) => row.origin === "revert").map((row) => row.editId)
  )
  return records.find(
    (record) =>
      record.seq > target.seq &&
      record.editId !== target.editId &&
      !reverted.has(record.editId) &&
      record.basedOn >= target.seq &&
      [...record.blocks].some((id) => target.blocks.has(id))
  )
}

const NEWER_FIRST =
  "Undo the newer Coach edit first. It was made on top of this one and changed the same blocks."

function refusedOutcomes(
  outcomes: readonly PaperEditOutcome[],
  missing: readonly { op: number; reason: string }[],
  problems: readonly string[]
): PaperEditOutcome[] {
  const why = problems[0] ?? "it could not be merged"
  return outcomes.map((outcome, op) => {
    if (outcome.status !== "applied") return outcome
    const own = missing.find((item) => item.op === op)
    return {
      status: "stale" as const,
      reason: own
        ? `${own.reason}. Nothing was written. Read paper.outline again`
        : `Nothing was written because the edit could not be merged safely (${why}). Read paper.outline again`,
    }
  })
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
    const base = documentOf(fork, row.kind)
    const { records } = await coachRecords(content)
    const newer = new Set(
      records
        .filter((record) => record.seq > input.basedOn)
        .flatMap((record) => [...record.blocks])
    )
    const live = content.document
    const applied = applyPaperEdits(base, live, input.edits, input.newId, newer)
    const answer = (
      editId: string | null,
      revision: number,
      outcomes: PaperEditOutcome[],
      changes: PaperChange[]
    ): CoachEditResult => ({
      docId,
      name: row.name,
      kind: row.kind,
      revision,
      editId,
      outcomes,
      changes,
    })
    if (applied.applied === 0) {
      return answer(null, row.contentVersion, applied.outcomes, [])
    }
    const update = writeDocument(
      fork,
      applied.target,
      coachOrigin(input.editId),
      applied.moved
    )
    if (!update) return answer(null, row.contentVersion, applied.outcomes, [])
    let missing: { op: number; reason: string }[] = []
    let changes: PaperChange[] = []
    const written = await content.append({
      origin: "coach",
      editId: input.editId,
      basedOn: input.basedOn,
      update,
      check: (merged) => {
        missing = effectsMissing(applied.effects, merged)
        changes = paperChanges(live, merged)
        return [
          ...missing.map((item) => item.reason),
          ...personWorkLost(base, live, merged),
        ]
      },
    })
    if (written.problems.length > 0) {
      return answer(
        null,
        row.contentVersion,
        refusedOutcomes(applied.outcomes, missing, written.problems),
        []
      )
    }
    if (!written.row)
      return answer(null, row.contentVersion, applied.outcomes, [])
    return answer(
      input.editId,
      written.row.contentVersion,
      applied.outcomes,
      changes
    )
  })
}

export async function undoBlockReason(
  userId: UserId,
  docId: PaperId,
  editId: string
): Promise<string | null> {
  return withContent(userId, docId, async (content) => {
    const { records, rows } = await coachRecords(content)
    const target = records.find((record) => record.editId === editId)
    return target && blockedBy(records, rows, target) ? NEWER_FIRST : null
  })
}

export async function revertCoachEdit(
  userId: UserId,
  docId: PaperId,
  editId: string
): Promise<{ revision: number; reverted: boolean }> {
  return withContent(userId, docId, async (content) => {
    const { records, rows } = await coachRecords(content)
    const target = records.find((record) => record.editId === editId)
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
    if (blockedBy(records, rows, target)) throw conflict(NEWER_FIRST)
    const live = content.document
    const plan = undoCoachEdit(target.pre, target.post, live)
    if (!plan.ok) throw conflict(plan.reason)
    const fork = await content.fork(content.row.contentVersion)
    const update = writeDocument(
      fork,
      plan.target,
      `revert:${coachOrigin(editId)}`,
      plan.moved
    )
    const written = await content.append({
      origin: "revert",
      editId,
      update: update ?? emptyUpdate(),
      keepIfIneffective: true,
      check: (merged) => undoProblems(target.pre, target.post, live, merged),
    })
    if (written.problems.length > 0) throw conflict(written.problems[0]!)
    return {
      revision: written.row?.contentVersion ?? content.row.contentVersion,
      reverted: update !== null,
    }
  })
}
