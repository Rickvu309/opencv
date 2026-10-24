import { useMemo, useRef, useState, type ReactNode } from "react"
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
  type DragEndEvent,
} from "@workspace/ui/components/kanban"
import { NumberTicker } from "@workspace/ui/components/number-ticker"
import {
  Status,
  StatusIndicator,
  StatusLabel,
} from "@workspace/ui/components/status"
import { cn } from "@workspace/ui/lib/utils"

import { BoardJobCardBody } from "@/features/apply/apply-board-card.tsx"
import {
  BOARD_INSTRUCTIONS,
  boardAnnouncements,
  boardItems,
  settleBoardMove,
  type BoardItem,
  type BoardPlacement,
} from "@/features/apply/apply-board-move.ts"
import {
  sortApplyCards,
  STAGES,
  type ApplyCard,
} from "@/features/apply/apply-types.ts"

const COLUMNS = STAGES.map((stage) => ({ id: stage.id, name: stage.label }))

type Props = {
  cards: ApplyCard[]
  selectedId: string | null
  filtering: boolean
  boardEmpty: boolean
  empty: ReactNode
  onSelect: (id: string) => void
  onMove: (id: string, placement: BoardPlacement) => void
}

export function ApplyBoard({
  cards,
  selectedId,
  filtering,
  boardEmpty,
  empty,
  onSelect,
  onMove,
}: Props) {
  const items = useMemo(() => boardItems(sortApplyCards(cards)), [cards])
  const [preview, setPreview] = useState<BoardItem[] | null>(null)
  const dragging = useRef(false)
  const data = preview ?? items

  function finish(event: DragEndEvent) {
    dragging.current = false
    const placement = event.over
      ? settleBoardMove(data, String(event.active.id), String(event.over.id))
      : null
    setPreview(null)
    if (placement) onMove(String(event.active.id), placement)
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
      {boardEmpty ? empty : null}
      <div data-apply-board className="min-h-[28rem] flex-1">
        <KanbanProvider
          columns={COLUMNS}
          data={data}
          className="h-full gap-2"
          accessibility={{
            announcements: boardAnnouncements(data),
            screenReaderInstructions: { draggable: BOARD_INSTRUCTIONS },
          }}
          onDragStart={() => {
            dragging.current = true
          }}
          onDataChange={(next) => {
            if (dragging.current) setPreview(next)
          }}
          onDragEnd={finish}
          onDragCancel={() => {
            dragging.current = false
            setPreview(null)
          }}
        >
          {(column) => {
            const stage = STAGES.find((s) => s.id === column.id)!
            const count = items.filter((c) => c.column === stage.id).length
            return (
              <KanbanBoard
                key={stage.id}
                id={stage.id}
                data-stage={stage.id}
                className="min-w-0 border-0 bg-background"
              >
                <KanbanHeader className="flex items-center gap-2 px-1 py-2 sm:px-2">
                  <Status className="min-w-0 gap-1 px-1 sm:gap-1.5 sm:px-1.5">
                    <StatusIndicator className={stage.dot} />
                    <StatusLabel className="truncate font-medium">
                      {stage.label}
                    </StatusLabel>
                  </Status>
                  <NumberTicker
                    value={count}
                    duration={280}
                    className="hidden text-xs font-normal text-muted-foreground sm:inline-flex"
                  />
                </KanbanHeader>
                {count === 0 && !boardEmpty ? (
                  <p className="px-3 text-xs text-muted-foreground">
                    {filtering
                      ? `No match in ${stage.label}`
                      : `Nothing in ${stage.label}`}
                  </p>
                ) : null}
                <KanbanCards<BoardItem> id={stage.id}>
                  {(item) => (
                    <KanbanCard
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      data-card-id={item.id}
                      aria-label={`${item.card.title} at ${item.card.company}`}
                      onClick={() => onSelect(item.id)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.defaultPrevented &&
                          !dragging.current
                        ) {
                          event.preventDefault()
                          onSelect(item.id)
                        }
                      }}
                      className={cn(
                        "gap-0 rounded-xl p-3 shadow-none",
                        item.id === selectedId
                          ? "ring-ring/40"
                          : "hover:ring-foreground/20"
                      )}
                    >
                      <BoardJobCardBody card={item.card} />
                    </KanbanCard>
                  )}
                </KanbanCards>
              </KanbanBoard>
            )
          }}
        </KanbanProvider>
      </div>
    </div>
  )
}
