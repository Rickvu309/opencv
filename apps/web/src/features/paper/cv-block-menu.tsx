import { useContext, type DragEvent } from "react"
import { useBlockNoteEditor } from "@blocknote/react"
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

import { CvChromeContext } from "./cv-blocks.tsx"
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
  const chrome = useContext(CvChromeContext)
  if (block.type === "paperHeader") return null
  const blocked = (type: string) =>
    block.children.length > 0 && !HOLDS_CHILDREN.has(type)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            aria-label="Drag block"
            draggable
            className="flex size-11 cursor-grab items-center justify-center rounded-md hover:bg-accent md:size-6"
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </div>
        }
      />
      <DropdownMenuContent className="w-[232px]">
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
          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => moveCvBlock(editor, block.id, "up")}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => moveCvBlock(editor, block.id, "down")}>
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            chrome.askCoach(
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
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
