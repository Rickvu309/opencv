import {
  COACH_SELECTION_TEXT_MAX,
  type CoachSelection,
} from "@workspace/domain"

import { previewCoachSelectionText } from "./paper-selection.ts"

export const ATTACH_FROM_PAPER_FAIL = "Couldn't attach that Paper doc."

export type CoachContextChipKind = "selection" | "doc"

export type CoachContextChip = {
  id: string
  kind: CoachContextChipKind
  pinned: boolean
  label: string
  selection?: CoachSelection
  docId?: string
  docName?: string
}

export type AttachDocResult =
  | { ok: true; chips: CoachContextChip[] }
  | { ok: false; chips: CoachContextChip[]; message: string }

function newChipId() {
  return crypto.randomUUID()
}

function sameSelection(
  left: CoachSelection | undefined,
  right: CoachSelection
) {
  return left?.text === right.text && left.sectionId === right.sectionId
}

export function addSelectionChip(
  chips: readonly CoachContextChip[],
  selection: CoachSelection,
  id = newChipId()
): CoachContextChip[] {
  const text = selection.text.trim()
  if (!text) return [...chips]
  if (chips.some((chip) => sameSelection(chip.selection, selection))) {
    return [...chips]
  }
  return [
    ...chips,
    {
      id,
      kind: "selection",
      pinned: false,
      label: previewCoachSelectionText(text),
      selection: { ...selection, text },
    },
  ]
}

export function addDocChip(
  chips: readonly CoachContextChip[],
  docId: string | undefined,
  docName: string,
  id = newChipId()
): AttachDocResult {
  const trimmedId = docId?.trim() ?? ""
  if (!trimmedId) {
    return {
      ok: false,
      chips: [...chips],
      message: ATTACH_FROM_PAPER_FAIL,
    }
  }
  if (chips.some((chip) => chip.kind === "doc" && chip.docId === trimmedId)) {
    return { ok: true, chips: [...chips] }
  }
  const name = docName.trim() || "This CV"
  return {
    ok: true,
    chips: [
      ...chips,
      {
        id,
        kind: "doc",
        pinned: false,
        label: name,
        docId: trimmedId,
        docName: name,
      },
    ],
  }
}

export function removeContextChip(
  chips: readonly CoachContextChip[],
  id: string
): CoachContextChip[] {
  return chips.filter((chip) => chip.id !== id)
}

export function toggleContextChipPin(
  chips: readonly CoachContextChip[],
  id: string
): CoachContextChip[] {
  return chips.map((chip) =>
    chip.id === id ? { ...chip, pinned: !chip.pinned } : chip
  )
}

export function consumeUnpinnedContextChips(
  chips: readonly CoachContextChip[]
): CoachContextChip[] {
  return chips.filter((chip) => chip.pinned)
}

export function selectionForTurn(
  chips: readonly CoachContextChip[],
  live?: CoachSelection | null
): CoachSelection | undefined {
  const selected = chips.filter(
    (chip): chip is CoachContextChip & { selection: CoachSelection } =>
      chip.kind === "selection" && Boolean(chip.selection?.text)
  )
  if (selected.length === 0) {
    return live?.text ? live : undefined
  }
  if (selected.length === 1) return selected[0].selection
  const text = selected
    .map((chip) => chip.selection.text)
    .join("\n\n")
    .slice(0, COACH_SELECTION_TEXT_MAX)
  const last = selected[selected.length - 1]
  const next: CoachSelection = { text }
  if (last.selection.sectionId) next.sectionId = last.selection.sectionId
  return next
}

export function hasAttachedDocChip(
  chips: readonly CoachContextChip[],
  docId: string
): boolean {
  return chips.some((chip) => chip.kind === "doc" && chip.docId === docId)
}

export function focusDocIdForTurn(
  softScope: boolean,
  chips: readonly CoachContextChip[],
  docId: string
): string | null {
  if (softScope || hasAttachedDocChip(chips, docId)) return docId
  return null
}

export function hasMatchingSelectionChip(
  chips: readonly CoachContextChip[],
  selection?: CoachSelection | null
): boolean {
  if (!selection?.text) return false
  return chips.some((chip) => sameSelection(chip.selection, selection))
}
