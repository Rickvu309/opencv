import { useSyncExternalStore } from "react"
import { wordReviewSchema } from "@workspace/domain"

export const WORD_BATCH_HIDDEN =
  "Approve is unavailable because this change cannot be shown in full."

export type WritingChange = {
  op: "replace" | "setText" | "insert" | "delete"
  before: string
  after: string
  place?: string | null
}

export type WritingProposal = {
  toolCallId: string
  docId: string
  changes: WritingChange[]
  pendingActionId: string | null
  withheld: string | null
}

export type WordBatchView =
  | { state: "none" }
  | { state: "withheld"; reason: string }
  | { state: "ready"; changes: WritingChange[] }

export function shownWord(text: string) {
  return text === "" ? "(empty line)" : text
}

export function wordChangeRows(change: WritingChange) {
  if (change.op === "setText") {
    return [
      { label: "Before", text: shownWord(change.before) },
      { label: "After", text: shownWord(change.after) },
    ]
  }
  if (change.op === "delete") {
    return [{ label: "Before", text: shownWord(change.before) }]
  }
  if (change.op !== "insert" || change.place === undefined) return []
  return [
    {
      label: "Where",
      text:
        change.place === null
          ? "At the start of the page"
          : `After this line: ${shownWord(change.place)}`,
    },
    { label: "After", text: shownWord(change.after) },
  ]
}

type Listener = () => void

let current: WritingProposal | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function writingProposal() {
  return current
}

export function subscribeWritingProposal(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function oneReplacement(input: unknown) {
  if (!input || typeof input !== "object") return null
  if (!("docId" in input) || typeof input.docId !== "string") return null
  if (!("edits" in input) || !Array.isArray(input.edits)) return null
  if (input.edits.length !== 1) return null
  const edit = input.edits[0]
  if (!edit || typeof edit !== "object") return null
  if (!("op" in edit) || edit.op !== "replaceText") return null
  if (!("before" in edit) || typeof edit.before !== "string") return null
  if (!("after" in edit) || typeof edit.after !== "string") return null
  if (edit.before.length === 0) return null
  const change: WritingChange = {
    op: "replace",
    before: edit.before,
    after: edit.after,
  }
  return { docId: input.docId, changes: [change], withheld: null }
}

function isWordEdit(
  edit: unknown
): edit is { op: "setText" | "insert" | "delete"; text?: string } {
  if (!edit || typeof edit !== "object" || !("op" in edit)) return false
  return edit.op === "setText" || edit.op === "insert" || edit.op === "delete"
}

function wordEdits(input: unknown) {
  if (!input || typeof input !== "object") return null
  if (!("docId" in input) || typeof input.docId !== "string") return null
  if (!("edits" in input) || !Array.isArray(input.edits)) return null
  if (input.edits.length === 0 || !input.edits.every(isWordEdit)) return null
  return { docId: input.docId, edits: input.edits }
}

function hidden(docId: string) {
  return { docId, changes: [], withheld: WORD_BATCH_HIDDEN }
}

function wordBatchFrom(input: unknown, review: unknown) {
  const batch = wordEdits(input)
  if (!batch) return null
  const parsed = wordReviewSchema.safeParse(review)
  if (!parsed.success || parsed.data.docId !== batch.docId)
    return hidden(batch.docId)
  if (parsed.data.operations.length !== batch.edits.length)
    return hidden(batch.docId)
  const changes: WritingChange[] = []
  for (let index = 0; index < batch.edits.length; index += 1) {
    const edit = batch.edits[index]
    const operation = parsed.data.operations[index]
    if (!edit || !operation || operation.op !== edit.op)
      return hidden(batch.docId)
    if (edit.op === "delete") {
      changes.push({ op: "delete", before: operation.before, after: "" })
      continue
    }
    if (!("text" in edit) || operation.after !== edit.text)
      return hidden(batch.docId)
    if (edit.op === "setText") {
      changes.push({
        op: "setText",
        before: operation.before,
        after: operation.after,
      })
      continue
    }
    if (operation.place === undefined) return hidden(batch.docId)
    changes.push({
      op: "insert",
      before: "",
      after: operation.after,
      place: operation.place,
    })
  }
  return { docId: batch.docId, changes, withheld: null }
}

function viewFromReview(review: unknown): WordBatchView {
  const parsed = wordReviewSchema.safeParse(review)
  if (!parsed.success) return { state: "none" }
  const changes: WritingChange[] = []
  for (const operation of parsed.data.operations) {
    if (operation.op === "insert" && operation.place === undefined) {
      return { state: "withheld", reason: WORD_BATCH_HIDDEN }
    }
    changes.push(
      operation.op === "insert"
        ? {
            op: "insert",
            before: "",
            after: operation.after,
            place: operation.place ?? null,
          }
        : {
            op: operation.op,
            before: operation.before,
            after: operation.after,
          }
    )
  }
  return { state: "ready", changes }
}

function isWordProposal(proposal: WritingProposal) {
  return (
    proposal.withheld !== null ||
    proposal.changes.some((change) => change.op !== "replace")
  )
}

export function wordBatchView(
  pendingActionId: string,
  review: unknown,
  proposal: WritingProposal | null
): WordBatchView {
  const carried = viewFromReview(review)
  if (carried.state !== "none") return carried
  if (!proposal || proposal.pendingActionId !== pendingActionId) {
    return { state: "none" }
  }
  if (!isWordProposal(proposal)) return { state: "none" }
  if (proposal.withheld) return { state: "withheld", reason: proposal.withheld }
  return {
    state: "ready",
    changes: proposal.changes.filter((change) => change.op !== "replace"),
  }
}

export function useWordBatchApproval(pendingActionId: string, review: unknown) {
  const proposal = useSyncExternalStore(
    subscribeWritingProposal,
    writingProposal,
    () => null
  )
  return wordBatchView(pendingActionId, review, proposal)
}

export function publishWritingProposal(
  toolCallId: string,
  input: unknown,
  review?: unknown
) {
  const parsed = oneReplacement(input) ?? wordBatchFrom(input, review)
  if (!parsed) return
  const pendingActionId =
    current?.toolCallId === toolCallId ? current.pendingActionId : null
  current = { toolCallId, pendingActionId, ...parsed }
  emit()
}

export function attachWritingProposal(
  toolCallId: string | null,
  pendingActionId: string
) {
  if (!current) return
  if (toolCallId && current.toolCallId !== toolCallId) return
  if (current.pendingActionId === pendingActionId) return
  current = { ...current, pendingActionId }
  emit()
}

export function clearWritingProposal(toolCallId?: string) {
  if (!current) return
  if (toolCallId && current.toolCallId !== toolCallId) return
  current = null
  emit()
}

type TaskAction = {
  toolCallId: string
  operation: string
  input: unknown
  state: string
  proposalId: string | null
}

type TaskConfirmation = {
  id: string
  input: unknown
  status: string
  review?: unknown
}

function sameProposal(next: WritingProposal) {
  if (!current) return false
  return (
    current.toolCallId === next.toolCallId &&
    current.docId === next.docId &&
    JSON.stringify(current.changes) === JSON.stringify(next.changes) &&
    current.pendingActionId === next.pendingActionId &&
    current.withheld === next.withheld
  )
}

export function syncWritingProposalFromActions(
  actions: readonly TaskAction[],
  confirmations: readonly TaskConfirmation[]
) {
  const pending = actions.find(
    (action) => action.operation === "paper.edit" && action.state === "proposed"
  )
  if (pending) {
    const confirmation = confirmations.find(
      (item) => item.id === pending.proposalId && item.status === "pending"
    )
    const parsed =
      oneReplacement(pending.input) ??
      oneReplacement(confirmation?.input) ??
      wordBatchFrom(pending.input, confirmation?.review) ??
      wordBatchFrom(confirmation?.input, confirmation?.review)
    if (parsed) {
      const next = {
        toolCallId: pending.toolCallId,
        pendingActionId: pending.proposalId,
        ...parsed,
      }
      if (!sameProposal(next)) {
        current = next
        emit()
      }
      return
    }
  }
  if (!current) return
  const owner = actions.find(
    (action) => action.toolCallId === current?.toolCallId
  )
  if (owner && (owner.state === "proposed" || owner.state === "planned")) {
    return
  }
  current = null
  emit()
}
