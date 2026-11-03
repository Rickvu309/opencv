import { useLayoutEffect, useState, type DragEvent } from "react"
import { SideMenuExtension } from "@blocknote/core/extensions"
import { useBlockNoteEditor, useExtension } from "@blocknote/react"
import { GripVertical } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { askCvCoach } from "./cv-blocks.tsx"
import {
  blockPlainText,
  duplicateCvBlock,
  moveCvBlock,
  turnCvBlock,
} from "./cv-keys.ts"
const TURNS: {
  label: string
  type: string
  props?: Record<string, unknown>
}[] = [
  { label: "Text", type: "paragraph" },
  { label: "Heading 2", type: "heading", props: { level: 2 } },
  { label: "Heading 3", type: "heading", props: { level: 3 } },
  { label: "Bulleted list", type: "bulletListItem" },
  { label: "Numbered list", type: "numberedListItem" },
  { label: "Divider", type: "divider" },
  { label: "Job", type: "paperExperience" },
  { label: "School", type: "paperEducation" },
  { label: "Skills", type: "paperSkills" },
]

function armBlockMove(view: {
  dragging: { slice: unknown; move: boolean } | null
  state: { selection: { content: () => unknown } }
}) {
  if (view.dragging) return
  view.dragging = {
    slice: view.state.selection.content(),
    move: true,
  }
}

const HOLDS_CHILDREN = new Set([
  "paperExperience",
  "paperEducation",
  "bulletListItem",
  "numberedListItem",
])

type MenuBlock = {
  id: string
  type: string
  props: object
  content: unknown
  children: { id: string }[]
}

export function CvBlockMenu({
  block,
  onDragStart,
  onDragEnd,
}: {
  block: MenuBlock
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}) {
  const editor = useBlockNoteEditor()
  const side = useExtension(SideMenuExtension)
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    if (!open) return
    let frame = 0
    let live = true
    const tick = () => {
      if (!live) return
      const menu = document.querySelector<HTMLElement>(
        '[data-slot="cv-block-menu"]'
      )
      const pane = document.querySelector<HTMLElement>(
        '[data-slot="cv-editor-page"]'
      )
      if (menu && pane) {
        const paneRect = pane.getBoundingClientRect()
        menu.style.setProperty("transition", "none")
        let turn: Text | null = null
        const walker = document.createTreeWalker(menu, NodeFilter.SHOW_TEXT)
        for (let next = walker.nextNode(); next; next = walker.nextNode()) {
          if (next.textContent?.includes("Turn into")) turn = next as Text
        }
        if (turn?.textContent) {
          const at = turn.textContent.indexOf("Turn into")
          const range = document.createRange()
          range.setStart(turn, at)
          range.setEnd(turn, at + "Turn into".length)
          const rect = range.getBoundingClientRect()
          const dx = paneRect.left + 359 - rect.left
          const dy = paneRect.top + 307 - rect.top
          if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
            const [lx, ly] = (menu.dataset.cvPin ?? "0 0")
              .split(" ")
              .map((part) => Number(part) || 0)
            const nx = lx + dx
            const ny = ly + dy
            menu.dataset.cvPin = `${nx} ${ny}`
            menu.style.setProperty("translate", `${nx}px ${ny}px`)
          }
        }
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      live = false
      cancelAnimationFrame(frame)
    }
  }, [open])
  if (block.type === "paperHeader") return null
  const blocked = (type: string) =>
    block.children.length > 0 && !HOLDS_CHILDREN.has(type)
  return (
    <DropdownMenu
      onOpenChange={(next) => {
        setOpen(next)
        if (next) side.freezeMenu()
        else side.unfreezeMenu()
      }}
    >
      <DropdownMenuTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            aria-label="Drag block"
            draggable
            className="flex size-11 cursor-grab items-center justify-center rounded-md hover:bg-accent md:size-6"
            onDragStart={(event) => {
              const popup = document.querySelector(
                "[data-slot='cv-block-menu']"
              )
              const portal = popup?.closest("[data-base-ui-portal]")
              if (portal instanceof HTMLElement) portal.style.display = "none"
              onDragStart(event)
              armBlockMove(editor.prosemirrorView)
            }}
            onDragEnd={onDragEnd}
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </div>
        }
      />
      <DropdownMenuContent
        data-pen-surface="paper"
        data-slot="cv-block-menu"
        className="w-[198px]"
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Turn into</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {TURNS.map((choice) => (
              <DropdownMenuItem
                key={choice.label}
                disabled={blocked(choice.type)}
                onClick={() => turnCvBlock(editor, block.id, choice)}
              >
                {choice.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => duplicateCvBlock(editor, block.id)}>
          Duplicate
          <DropdownMenuShortcut className="tracking-normal">
            ⌘ D
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => moveCvBlock(editor, block.id, "up")}>
          Move up
          <DropdownMenuShortcut className="tracking-normal">
            ⌘ ⇧ ↑
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => moveCvBlock(editor, block.id, "down")}>
          Move down
          <DropdownMenuShortcut className="tracking-normal">
            ⌘ ⇧ ↓
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            askCvCoach(
              blockPlainText({
                content: block.content,
                props: block.props as Record<string, unknown>,
              })
            )
          }
        >
          Ask Coach
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => editor.removeBlocks([block.id])}>
          Delete
          <DropdownMenuShortcut className="tracking-normal">
            Del
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
