import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  plainTextOf,
  type BlockType,
  type CvBlock,
  type CvSectionKind,
} from "@workspace/domain"

import { PaperBlockMenu } from "./paper-block-menu.tsx"
import { PaperSlashMenu, type SlashChoice } from "./paper-slash-menu.tsx"
import { blockFields, blockPlaceholder } from "./paper-block-fields.tsx"
import { useReducedMotion } from "./paper-block-field.tsx"

export function SortableBlock({
  block,
  sectionKind,
  slash,
  onChange,
  onCommit,
  onOpenSlash,
  onSlashQuery,
  onSlashActive,
  onPick,
  onCloseSlash,
  onDuplicate,
  onMove,
  onDelete,
  onTurnInto,
  onAskCoach,
}: {
  block: CvBlock
  sectionKind: CvSectionKind
  slash: { query: string; index: number; side: "top" | "bottom" } | null
  onChange: (block: CvBlock) => void
  onCommit: (block: CvBlock) => void
  onOpenSlash: (node: HTMLElement) => void
  onSlashQuery: (query: string) => void
  onSlashActive: (index: number) => void
  onPick: (choice: SlashChoice) => void
  onCloseSlash: () => void
  onDuplicate: () => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onTurnInto: (type: BlockType) => void
  onAskCoach: () => void
}) {
  const [editing, setEditing] = useState(false)
  const focusField = useRef(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const reduced = useReducedMotion()
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: block.id,
    })
  const style = reduced
    ? undefined
    : { transform: CSS.Transform.toString(transform), transition }
  const Field = blockFields[block.type]
  const name = plainTextOf(block).trim() || blockPlaceholder(block, sectionKind)

  useEffect(() => {
    if (!focusField.current) return
    focusField.current = false
    rootRef.current?.querySelector<HTMLElement>("[role='textbox']")?.focus()
  }, [editing])

  function setRoot(node: HTMLDivElement | null) {
    rootRef.current = node
    setNodeRef(node)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    const meta = event.metaKey || event.ctrlKey
    if (event.key === "Enter") {
      event.preventDefault()
      if (editing) {
        event.currentTarget
          .querySelector<HTMLElement>("[role='textbox']")
          ?.focus()
        return
      }
      focusField.current = true
      setEditing(true)
    } else if (meta && event.key.toLowerCase() === "d") {
      event.preventDefault()
      onDuplicate()
    } else if (meta && event.shiftKey && event.key === "ArrowUp") {
      event.preventDefault()
      onMove(-1)
    } else if (meta && event.shiftKey && event.key === "ArrowDown") {
      event.preventDefault()
      onMove(1)
    } else if (event.key === "Delete") {
      event.preventDefault()
      onDelete()
    }
  }

  return (
    <div
      ref={setRoot}
      data-sortable-block={block.id}
      style={style}
      tabIndex={0}
      aria-label={name}
      className="relative flex items-start gap-1"
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        if (event.target === event.currentTarget) setEditing(false)
      }}
      onBlur={(event) => {
        // Chrome reports document.activeElement as body during focusout, before
        // the next field is focused. relatedTarget is already that field.
        const next = event.relatedTarget
        const root = rootRef.current
        if (root && next instanceof Node && root.contains(next)) return
        setEditing(false)
      }}
    >
      <PaperBlockMenu
        type={block.type}
        dragAttributes={attributes as unknown as Record<string, unknown>}
        dragListeners={listeners as unknown as Record<string, unknown>}
        onTurnInto={onTurnInto}
        onDuplicate={onDuplicate}
        onMoveUp={() => onMove(-1)}
        onMoveDown={() => onMove(1)}
        onAskCoach={onAskCoach}
        onDelete={onDelete}
      />
      <Field
        block={block}
        sectionKind={sectionKind}
        editing={editing}
        onChange={onChange}
        onCommit={onCommit}
        onSlash={onOpenSlash}
      />
      {slash ? (
        <PaperSlashMenu
          query={slash.query}
          activeIndex={slash.index}
          side={slash.side}
          onQuery={onSlashQuery}
          onActive={onSlashActive}
          onPick={onPick}
          onClose={onCloseSlash}
        />
      ) : null}
    </div>
  )
}
