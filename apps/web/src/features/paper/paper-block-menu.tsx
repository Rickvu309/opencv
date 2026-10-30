import { useReducer, type KeyboardEvent } from "react"
import { GripVertical } from "lucide-react"
import { blockEntry, type BlockType } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

const TURN_LABEL: Record<string, string> = {
  text: "Text",
  heading: "Heading",
  "bulleted-list": "Bulleted list",
  "numbered-list": "Numbered list",
  divider: "Divider",
}

function openSide(node: HTMLElement): "top" | "bottom" {
  const space = window.innerHeight - node.getBoundingClientRect().bottom
  return space < 280 ? "top" : "bottom"
}

export function PaperBlockMenu({
  type,
  dragAttributes,
  dragListeners,
  onTurnInto,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onAskCoach,
  onDelete,
}: {
  type: BlockType
  dragAttributes?: Record<string, unknown>
  dragListeners?: Record<string, unknown>
  onTurnInto: (type: BlockType) => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAskCoach: () => void
  onDelete: () => void
}) {
  const [side, dispatchSide] = useReducer(
    (_: "top" | "bottom", measured: "top" | "bottom") => measured,
    "bottom"
  )
  const turns = blockEntry(type).turnInto

  function place(node: HTMLElement) {
    dispatchSide(openSide(node))
  }

  function onKeyDownCapture(event: KeyboardEvent<HTMLButtonElement>) {
    const listen = dragListeners?.onKeyDown
    if (typeof listen === "function") {
      listen(event)
    }
    if (event.key === " ") event.preventDefault()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const meta = event.metaKey || event.ctrlKey
    if (event.key === " ") event.preventDefault()
    if (meta && event.key.toLowerCase() === "d") {
      event.preventDefault()
      onDuplicate()
    } else if (meta && event.shiftKey && event.key === "ArrowUp") {
      event.preventDefault()
      onMoveUp()
    } else if (meta && event.shiftKey && event.key === "ArrowDown") {
      event.preventDefault()
      onMoveDown()
    } else if (event.key === "Delete") {
      event.preventDefault()
      onDelete()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="mt-0.5 shrink-0"
            {...dragAttributes}
            {...dragListeners}
            aria-label="Block menu"
            tabIndex={0}
            onFocus={(event) => place(event.currentTarget)}
            onPointerDown={(event) => place(event.currentTarget)}
            onKeyDownCapture={onKeyDownCapture}
            onKeyDown={onKeyDown}
          >
            <GripVertical />
          </Button>
        }
      />
      <DropdownMenuContent side={side} className="motion-reduce:animate-none">
        {turns.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Turn into</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="motion-reduce:animate-none">
              {turns.map((item) => (
                <DropdownMenuItem
                  key={item}
                  onClick={() => onTurnInto(item as BlockType)}
                >
                  {TURN_LABEL[item] ?? item}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuItem onClick={onDuplicate}>
          Duplicate
          <DropdownMenuShortcut>⌘ D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMoveUp}>
          Move up
          <DropdownMenuShortcut>⌘ ⇧ ↑</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMoveDown}>
          Move down
          <DropdownMenuShortcut>⌘ ⇧ ↓</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAskCoach}>Ask Coach</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete}>
          Delete
          <DropdownMenuShortcut>Del</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
