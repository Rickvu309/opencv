import { useState, type KeyboardEvent } from "react"
import { GripVertical } from "lucide-react"

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

import type { SlashBlockType } from "./paper-slash-menu.tsx"

const TURN_INTO: { type: SlashBlockType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "heading", label: "Heading" },
  { type: "bulleted-list", label: "Bulleted list" },
  { type: "numbered-list", label: "Numbered list" },
  { type: "divider", label: "Divider" },
]

function openSide(node: HTMLElement): "top" | "bottom" {
  const space = window.innerHeight - node.getBoundingClientRect().bottom
  return space < 280 ? "top" : "bottom"
}

export function PaperBlockMenu({
  dragAttributes,
  dragListeners,
  onTurnInto,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onAskCoach,
  onDelete,
}: {
  dragAttributes?: Record<string, unknown>
  dragListeners?: Record<string, unknown>
  onTurnInto: (type: SlashBlockType) => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAskCoach: () => void
  onDelete: () => void
}) {
  const [side, setSide] = useState<"top" | "bottom">("bottom")

  function place(node: HTMLElement) {
    setSide(openSide(node))
  }

  function onKeyDownCapture(event: KeyboardEvent<HTMLButtonElement>) {
    const listen = dragListeners?.onKeyDown
    if (typeof listen === "function") listen(event)
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
            aria-label="Block menu"
            className="mt-0.5 shrink-0"
            {...dragAttributes}
            {...dragListeners}
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Turn into</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="motion-reduce:animate-none">
            {TURN_INTO.map((item) => (
              <DropdownMenuItem
                key={item.type}
                onClick={() => onTurnInto(item.type)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
