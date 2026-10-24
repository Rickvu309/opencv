import { arrayMove, type Announcements } from "@workspace/ui/components/kanban"

import {
  STAGES,
  type ApplyCard,
  type StageId,
} from "@/features/apply/apply-types.ts"

export type BoardItem = {
  id: string
  name: string
  column: StageId
  card: ApplyCard
}

export type BoardPlacement = {
  stage: StageId
  beforeCardId: string | null
}

export function boardItems(cards: readonly ApplyCard[]): BoardItem[] {
  return cards.map((card) => ({
    id: card.id,
    name: card.title,
    column: card.stage,
    card,
  }))
}

function stageLabel(id: string | undefined) {
  return STAGES.find((stage) => stage.id === id)?.label ?? "this Stage"
}

/**
 * Where a dropped card lands. `base` is the board as it looks at drop time,
 * which already holds the card in its new Stage after a cross-Stage hover.
 * Dropping on another card takes that card's slot, the way the sortable does.
 */
export function settleBoardMove(
  base: readonly BoardItem[],
  activeId: string,
  overId: string | null | undefined
): BoardPlacement | null {
  const from = base.findIndex((item) => item.id === activeId)
  if (from === -1) return null
  const to =
    overId && overId !== activeId ? base.findIndex((i) => i.id === overId) : -1
  const list = to === -1 ? [...base] : arrayMove([...base], from, to)
  const moved = list.find((item) => item.id === activeId)
  if (!moved) return null
  const column = list.filter((item) => item.column === moved.column)
  const next = column[column.findIndex((item) => item.id === activeId) + 1]
  return { stage: moved.column, beforeCardId: next?.id ?? null }
}

export function boardAnnouncements(items: readonly BoardItem[]): Announcements {
  const nameOf = (id: string | number) =>
    items.find((item) => item.id === id)?.name ?? "the Opportunity"
  const stageOf = (id: string | number | undefined) =>
    stageLabel(items.find((item) => item.id === id)?.column ?? String(id))
  return {
    onDragStart: ({ active }) =>
      `Picked up the Opportunity ${nameOf(active.id)} from ${stageOf(active.id)}`,
    onDragOver: ({ active, over }) =>
      `${nameOf(active.id)} is over ${stageOf(over?.id)}`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Moved the Opportunity ${nameOf(active.id)} to ${stageOf(over.id)}`
        : `${nameOf(active.id)} stays in ${stageOf(active.id)}`,
    onDragCancel: ({ active }) =>
      `Cancelled. ${nameOf(active.id)} stays in ${stageOf(active.id)}`,
  }
}

export const BOARD_INSTRUCTIONS =
  "Press Space to pick up this Opportunity, the arrow keys to move it between Stages, Space to drop it and Escape to cancel. Press Enter to open it."
