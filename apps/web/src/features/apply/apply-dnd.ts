import type { DragEvent } from "react"

import { APPLY_DRAG_TYPE } from "@/features/apply/apply-types.ts"

export function setCardDragData(e: DragEvent, cardId: string) {
  e.dataTransfer.setData(APPLY_DRAG_TYPE, cardId)
  e.dataTransfer.effectAllowed = "move"
}

export function readCardDragId(e: DragEvent) {
  return e.dataTransfer.getData(APPLY_DRAG_TYPE)
}

export function allowCardDrop(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer.dropEffect = "move"
}
