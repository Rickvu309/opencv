import type { CoalescedWrite } from "./paper-package-journal.ts"

export class AckRefusal extends Error {
  readonly code: "empty-draft" | "empty-reply"

  constructor(code: "empty-draft" | "empty-reply") {
    super(code)
    this.name = "AckRefusal"
    this.code = code
  }
}

export type LocalTransaction = "pending" | "complete" | "aborted"

export type LocalObservation = {
  readonly generation: number
  readonly words: string
  readonly transaction: LocalTransaction
}

export type ServerReceipt = {
  readonly commandId: string
  readonly generation: number
  readonly words: string
}

export type Acknowledgement =
  | { readonly kind: "receipt"; readonly receipt: ServerReceipt }
  | {
      readonly kind: "refusal"
      readonly commandId: string
      readonly generation: number
    }

export type PackageDraft = {
  readonly commandId: string
  readonly generation: number
  readonly words: string
  readonly saved: boolean
}

function freeze(draft: PackageDraft): PackageDraft {
  return Object.freeze({
    commandId: draft.commandId,
    generation: draft.generation,
    words: draft.words,
    saved: draft.saved,
  })
}

export function draftFromWrite(write: CoalescedWrite): PackageDraft {
  if (
    typeof write?.commandId !== "string" ||
    write.commandId.length === 0 ||
    !Number.isInteger(write.generation) ||
    write.generation < 1 ||
    typeof write.words !== "string"
  )
    throw new AckRefusal("empty-draft")
  return freeze({
    commandId: write.commandId,
    generation: write.generation,
    words: write.words,
    saved: false,
  })
}

function generationOf(reply: Acknowledgement) {
  return reply.kind === "receipt" ? reply.receipt.generation : reply.generation
}

function sameGeneration(draft: PackageDraft, reply: Acknowledgement) {
  const generation = generationOf(reply)
  return Number.isInteger(generation) && generation === draft.generation
}

export function applyReply(
  draft: PackageDraft,
  local: LocalObservation | null,
  reply: Acknowledgement
): PackageDraft {
  if (
    draft == null ||
    typeof draft.words !== "string" ||
    typeof draft.commandId !== "string" ||
    !Number.isInteger(draft.generation)
  )
    throw new AckRefusal("empty-draft")
  if (reply == null || (reply.kind !== "receipt" && reply.kind !== "refusal"))
    throw new AckRefusal("empty-reply")
  if (!sameGeneration(draft, reply)) return draft
  if (reply.kind === "refusal") return freeze({ ...draft, saved: false })
  const receipt = reply.receipt
  const stored =
    local?.transaction === "complete" &&
    local.generation === draft.generation &&
    local.words === draft.words
  const matched =
    receipt.commandId === draft.commandId &&
    receipt.generation === draft.generation &&
    receipt.words === draft.words
  return freeze({ ...draft, saved: stored && matched })
}
