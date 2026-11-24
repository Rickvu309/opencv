import {
  applyPaperEdits,
  effectsMissing,
  ERROR_CODES,
  paperChanges,
  paperDocumentSchema,
  personWorkLost,
  rebuiltBy,
  undoCoachEdit,
  undoProblems,
  type Actor,
  type NativeBasis,
  type NativeWriter,
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
  readEdit,
  writeDocument,
  type HistoryRow,
  type PaperResult,
  type PaperYDoc,
} from "@workspace/paper-crdt"

import { CommandError } from "../platform/errors.js"
import { blockingEdit, NEWER_FIRST, revertedIds } from "./undo-rules.js"
import {
  coachBasisOk,
  withContent,
  type LockedContent,
  type LogRow,
} from "./content-store.js"

export type CoachEditInput = {
  readonly writer?: NativeWriter
  readonly nativeBasis?: NativeBasis
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

export function stalePaperBasis(basedOn: number, revision: number) {
  if (basedOn === revision) return "apply" as const
  return "refuse" as const
}

function checkedBasis(
  content: LockedContent,
  basedOn: number,
  proposal: boolean
) {
  const revision = content.row.contentVersion
  if (proposal && stalePaperBasis(basedOn, revision) === "refuse") {
    throw conflict(
      `basedOn ${basedOn} is not revision ${revision}. Read paper.outline again`
    )
  }
  if (coachBasisOk(basedOn, revision, content.baseSeq)) return
  if (basedOn > revision) {
    throw conflict(
      `basedOn ${basedOn} is ahead of revision ${revision}. Read paper.outline again`
    )
  }
  throw conflict(
    `basedOn ${basedOn} is older than this document's history. Read paper.outline again`
  )
}

function imagesOf(
  content: LockedContent,
  base: Uint8Array,
  rows: readonly LogRow[],
  seq: number
) {
  const replay = loadYDoc(base, [])
  for (const row of rows) {
    if (row.seq < seq) absorbUpdate(replay, row.update, "log")
  }
  const pre = documentOf(replay, content.row.kind)
  const edit = rows.find((row) => row.seq === seq)!
  absorbUpdate(replay, edit.update, "log")
  return { pre, post: documentOf(replay, content.row.kind) }
}

function documentFrom(
  result: PaperResult,
  kind: PaperStoredKind
): PaperDocument | null {
  if (!result.ok) return null
  const parsed = paperDocumentSchema.safeParse(result.document)
  return parsed.success && parsed.data.kind === kind ? parsed.data : null
}

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
  input: CoachEditInput,
  actor: Actor
): Promise<CoachEditResult> {
  return withContent(
    userId,
    docId,
    async (content) => {
      checkedBasis(content, input.basedOn, actor.type === "coach")
      const { row } = content
      const fork = await content.fork(input.basedOn)
      const base = documentOf(fork, row.kind)
      const { rows } = await content.history()
      const reverted = revertedIds(rows)
      const after = rows.filter((item) => item.seq > input.basedOn)
      const newer = new Set([
        ...after
          .filter(
            (item) => item.origin === "coach" && !reverted.has(item.editId)
          )
          .flatMap((item) => item.touched ?? []),
        ...after.flatMap((item) => item.rebuilt ?? []),
      ])
      const typedSince = rows
        .filter((item) => item.origin !== "coach" && item.origin !== "revert")
        .filter((item) => item.seq > input.basedOn)
        .map((item) => item.update)
      const live = content.document
      const applied = applyPaperEdits(
        base,
        live,
        input.edits,
        input.newId,
        newer
      )
      const rebuiltRoots = [
        ...applied.moved,
        ...applied.effects
          .filter(
            (effect) => effect.kind === "created" || effect.kind === "removed"
          )
          .map((effect) => effect.id),
      ]
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
        protect: typedSince,
        touched: () => changes.map((change) => change.blockId),
        rebuilt: (merged) => rebuiltBy(live, merged, rebuiltRoots),
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
    },
    { writer: input.writer, basis: input.nativeBasis, proposal: true }
  )
}

export async function revertCoachEdit(
  userId: UserId,
  docId: PaperId,
  editId: string,
  writer?: NativeWriter
): Promise<{ revision: number; reverted: boolean }> {
  return withContent(
    userId,
    docId,
    async (content) => {
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
      if (revertedIds(rows).has(editId)) {
        return { revision: content.row.contentVersion, reverted: false }
      }
      if (blockingEdit(rows, target)) throw conflict(NEWER_FIRST)
      const kind = content.row.kind
      const { pre, post } = imagesOf(content, base, rows, target.seq)
      const reading = readEdit(historyOf(base, rows), coachOrigin(editId))
      if (!reading) throw conflict("This edit was already undone")
      const expected = {
        reverted: documentFrom(reading.reverted, kind),
        stripped: documentFrom(reading.stripped, kind),
      }
      const live = content.document
      const plan = undoCoachEdit(pre, post, live, {
        ...expected,
        broken: reading.broken,
      })
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
        rebuilt: target.rebuilt ?? [],
        check: (merged) => undoProblems(pre, post, live, merged, expected),
      })
      if (written.problems.length > 0) throw conflict(written.problems[0]!)
      return {
        revision: written.row?.contentVersion ?? content.row.contentVersion,
        reverted: update !== null,
      }
    },
    { writer }
  )
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
