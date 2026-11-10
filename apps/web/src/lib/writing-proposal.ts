export type WritingProposal = {
  toolCallId: string
  docId: string
  before: string
  after: string
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
  return { docId: input.docId, before: edit.before, after: edit.after }
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
