"use client"

import type {
  Announcements,
  CollisionDetection,
  DndContextProps,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
  UniqueIdentifier,
} from "@dnd-kit/core"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import tunnel from "tunnel-rat"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

const t = tunnel()

export { arrayMove } from "@dnd-kit/sortable"
export type {
  Announcements,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core"

type KanbanItemProps = {
  id: string
  name: string
  column: string
} & Record<string, unknown>

type KanbanColumnProps = {
  id: string
  name: string
} & Record<string, unknown>

type KanbanContextProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = {
  columns: C[]
  data: T[]
  activeCardId: string | null
}

const KanbanContext = createContext<KanbanContextProps>({
  columns: [],
  data: [],
  activeCardId: null,
})

function columnIdForOver(
  id: UniqueIdentifier | null | undefined,
  columns: readonly { id: UniqueIdentifier }[],
  data: readonly { id: UniqueIdentifier; column: string }[]
) {
  if (id == null) return undefined
  if (columns.some((column) => column.id === id)) return String(id)
  return data.find((item) => item.id === id)?.column
}

function columnNameForOver(
  id: UniqueIdentifier | null | undefined,
  columns: readonly { id: UniqueIdentifier; name: string }[],
  data: readonly { id: UniqueIdentifier; column: string }[]
) {
  const columnId = columnIdForOver(id, columns, data)
  if (!columnId) return undefined
  return columns.find((column) => String(column.id) === columnId)?.name
}

export type KanbanBoardProps = Omit<HTMLAttributes<HTMLDivElement>, "id"> & {
  id: string
}

export const KanbanBoard = ({
  id,
  children,
  className,
  ...props
}: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  })

  return (
    <div
      data-slot="kanban-board"
      className={cn(
        "flex size-full min-h-40 flex-col overflow-hidden rounded-xl border bg-secondary text-xs ring-2 transition-[box-shadow] duration-(--duration-micro) ease-(--ease-micro)",
        isOver ? "ring-ring/40" : "ring-transparent",
        className
      )}
      ref={setNodeRef}
      {...props}
    >
      {children}
    </div>
  )
}

export type KanbanCardProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "id" | "children"
> & {
  id: string
  name: string
  children?: ReactNode
}

export const KanbanCard = ({
  id,
  name,
  children,
  className,
  onKeyDown,
  ...props
}: KanbanCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    transform,
    isDragging,
  } = useSortable({
    id,
  })
  const { activeCardId } = useContext(KanbanContext) as KanbanContextProps

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  }

  return (
    <>
      <div
        data-slot="kanban-card"
        style={style}
        {...props}
        {...listeners}
        {...attributes}
        onKeyDown={(event) => {
          listeners?.onKeyDown?.(event)
          onKeyDown?.(event)
        }}
        ref={setNodeRef}
      >
        <Card
          className={cn(
            "cursor-grab gap-4 rounded-md p-3 shadow-sm",
            isDragging && "pointer-events-none cursor-grabbing opacity-30",
            className
          )}
        >
          {children ?? <p className="m-0 text-sm font-medium">{name}</p>}
        </Card>
      </div>
      {activeCardId === id && (
        <t.In>
          <Card
            className={cn(
              "cursor-grab gap-4 rounded-md p-3 shadow-sm ring-2 ring-ring",
              isDragging && "cursor-grabbing",
              className
            )}
          >
            {children ?? <p className="m-0 text-sm font-medium">{name}</p>}
          </Card>
        </t.In>
      )}
    </>
  )
}

export type KanbanCardsProps<T extends KanbanItemProps = KanbanItemProps> =
  Omit<HTMLAttributes<HTMLDivElement>, "children" | "id"> & {
    children: (item: T) => ReactNode
    id: string
  }

export const KanbanCards = <T extends KanbanItemProps = KanbanItemProps>({
  children,
  className,
  ...props
}: KanbanCardsProps<T>) => {
  const { data } = useContext(KanbanContext) as KanbanContextProps<T>
  const filteredData = data.filter((item) => item.column === props.id)
  const items = filteredData.map((item) => item.id)

  return (
    <SortableContext items={items}>
      <div
        data-slot="kanban-cards"
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto p-2",
          className
        )}
        {...props}
      >
        {filteredData.map(children)}
      </div>
    </SortableContext>
  )
}

export type KanbanHeaderProps = HTMLAttributes<HTMLDivElement>

export const KanbanHeader = ({ className, ...props }: KanbanHeaderProps) => (
  <div
    data-slot="kanban-header"
    className={cn("m-0 p-2 text-sm font-semibold", className)}
    {...props}
  />
)

export type KanbanProviderProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = Omit<DndContextProps, "children"> & {
  children: (column: C) => ReactNode
  className?: string
  columns: C[]
  data: T[]
  onDataChange?: (data: T[]) => void
  onDragStart?: (event: DragStartEvent) => void
  onDragEnd?: (event: DragEndEvent) => void
  onDragOver?: (event: DragOverEvent) => void
}

export const KanbanProvider = <
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
>({
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
  className,
  columns,
  data,
  onDataChange,
  ...props
}: KanbanProviderProps<T, C>) => {
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  // Set only while a keyboard arrow is stepping columns. Pointer drags leave it empty.
  const keyboardColumnId = useRef<UniqueIdentifier | null>(null)

  // Arrow keys step one column in board order. A corner-distance step skips an
  // empty column when a later card has nearer corners.
  const coordinateGetter: KeyboardCoordinateGetter = (event, { context }) => {
    if (event.code === KeyboardCode.Up || event.code === KeyboardCode.Down) {
      keyboardColumnId.current = null
      return sortableKeyboardCoordinates(event, {
        active: context.active?.id ?? "",
        currentCoordinates: {
          x: context.collisionRect?.left ?? 0,
          y: context.collisionRect?.top ?? 0,
        },
        context,
      })
    }

    if (event.code !== KeyboardCode.Left && event.code !== KeyboardCode.Right) {
      return undefined
    }

    event.preventDefault()
    const { collisionRect } = context
    if (!context.active || !collisionRect) return undefined

    const currentId =
      columnIdForOver(context.over?.id, columns, data) ??
      columnIdForOver(context.active.id, columns, data)
    const index = columns.findIndex((column) => String(column.id) === currentId)
    if (index < 0) return undefined

    const next =
      columns[event.code === KeyboardCode.Right ? index + 1 : index - 1]
    if (!next) return undefined

    const rect = context.droppableRects.get(next.id)
    if (!rect) return undefined

    const width = rect.width > 0 ? rect.width : 240
    const height = rect.height > 0 ? rect.height : 160
    keyboardColumnId.current = next.id
    return {
      x: rect.left + width / 2 - collisionRect.width / 2,
      y: rect.top + height / 2 - collisionRect.height / 2,
    }
  }

  const collisionDetection: CollisionDetection = (args) => {
    const hits = closestCenter(args)
    const columnId = keyboardColumnId.current
    if (columnId == null) return hits
    if (!args.droppableContainers.some((entry) => entry.id === columnId)) {
      return hits
    }
    return [{ id: columnId }, ...hits.filter((hit) => hit.id !== columnId)]
  }

  // A click is not a drag: the pointer must move 6px, a touch must hold 200ms.
  // Space picks up and drops, so Enter stays free for opening the card.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    keyboardColumnId.current = null
    const card = data.find((item) => item.id === event.active.id)
    if (card) {
      setActiveCardId(event.active.id as string)
    }
    onDragStart?.(event)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) {
      return
    }

    const activeItem = data.find((item) => item.id === active.id)
    const overItem = data.find((item) => item.id === over.id)

    if (!activeItem) {
      return
    }

    const activeColumn = activeItem.column
    const overColumn =
      overItem?.column ||
      columns.find((col) => col.id === over.id)?.id ||
      columns[0]?.id

    if (overColumn && activeColumn !== overColumn) {
      let newData = [...data]
      const activeIndex = newData.findIndex((item) => item.id === active.id)
      const overIndex = newData.findIndex((item) => item.id === over.id)

      newData[activeIndex] = {
        ...newData[activeIndex],
        column: overColumn,
      } as T
      newData = arrayMove(newData, activeIndex, overIndex)

      onDataChange?.(newData)
    }

    onDragOver?.(event)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    keyboardColumnId.current = null
    setActiveCardId(null)

    onDragEnd?.(event)

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    let newData = [...data]

    const oldIndex = newData.findIndex((item) => item.id === active.id)
    const newIndex = newData.findIndex((item) => item.id === over.id)

    newData = arrayMove(newData, oldIndex, newIndex)

    onDataChange?.(newData)
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const { name, column } = data.find((item) => item.id === active.id) ?? {}

      return `Picked up the card "${name}" from the "${column}" column`
    },
    onDragOver({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {}
      const newColumn = columnNameForOver(over?.id, columns, data)
      if (!newColumn) return undefined

      return `Dragged the card "${name}" over the "${newColumn}" column`
    },
    onDragEnd({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {}
      const newColumn = columnNameForOver(over?.id, columns, data)
      if (!newColumn) return undefined

      return `Dropped the card "${name}" into the "${newColumn}" column`
    },
    onDragCancel({ active }) {
      const { name } = data.find((item) => item.id === active.id) ?? {}

      return `Cancelled dragging the card "${name}"`
    },
  }

  return (
    <KanbanContext.Provider value={{ columns, data, activeCardId }}>
      <DndContext
        accessibility={{ announcements }}
        collisionDetection={collisionDetection}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
        {...props}
      >
        <div
          data-slot="kanban"
          className={cn(
            "grid size-full auto-cols-fr grid-flow-col gap-4",
            className
          )}
        >
          {columns.map((column) => children(column))}
        </div>
        {typeof window !== "undefined" &&
          createPortal(
            <DragOverlay>
              <div data-slot="kanban-overlay">
                <t.Out />
              </div>
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </KanbanContext.Provider>
  )
}
