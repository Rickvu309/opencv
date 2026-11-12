import { wordReviewSchema } from "@workspace/domain"

export type WritingChange = {
  op: "replace" | "setText" | "insert" | "delete"
  before: string
  after: string
}

export type WritingProposal = {
  toolCallId: string
  docId: string
  changes: WritingChange[]
  pendingActionId: string | null
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
  return { docId: input.docId, changes: [change] }
}

function reviewedBatch(input: unknown, review: unknown) {
  if (!input || typeof input !== "object") return null
  if (!("docId" in input) || typeof input.docId !== "string") return null
  if (!("edits" in input) || !Array.isArray(input.edits)) return null
  const parsed = wordReviewSchema.safeParse(review)
  if (!parsed.success || parsed.data.docId !== input.docId) return null
  if (parsed.data.operations.length !== input.edits.length) return null
  return { docId: input.docId, changes: parsed.data.operations }
}

export function publishWritingProposal(toolCallId: string, input: unknown) {
  const parsed = oneReplacement(input)
  if (!parsed) return
  current = { toolCallId, pendingActionId: null, ...parsed }
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
    current.pendingActionId === next.pendingActionId
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
      reviewedBatch(pending.input, confirmation?.review)
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
