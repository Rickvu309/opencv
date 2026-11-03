import { useBlockNoteEditor } from "@blocknote/react"
import { Ellipsis } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { ensureCvSection } from "./cv-slash.ts"
import { changeBlockType, type BlockTarget } from "./list-block-ops.ts"
import { duplicateCvBlock } from "./cv-rules.ts"

const TURNS: { label: string; target: BlockTarget; section?: string }[] = [
  { label: "Text", target: { type: "paragraph" } },
  { label: "Heading 2", target: { type: "heading", props: { level: 2 } } },
  { label: "Heading 3", target: { type: "heading", props: { level: 3 } } },
  { label: "Bulleted list", target: { type: "bulletListItem" } },
  { label: "Numbered list", target: { type: "numberedListItem" } },
  { label: "Divider", target: { type: "divider" } },
  {
    label: "Job",
    target: { type: "paperExperience" },
    section: "experience",
  },
  {
    label: "School",
    target: { type: "paperEducation" },
    section: "education",
  },
  { label: "Skills", target: { type: "paperSkills" }, section: "skills" },
]

type MenuBlock = { id: string; type: string }

type MenuEditor = {
  updateBlock: (id: string, update: unknown) => void
  removeBlocks: (ids: string[]) => void
  moveBlocksUp: (id: string) => void
  moveBlocksDown: (id: string) => void
  setTextCursorPosition: (id: string, pos: "start" | "end") => void
}

export function CvBlockMenu({ block }: { block: MenuBlock }) {
  const editor = useBlockNoteEditor() as unknown as MenuEditor
  if (block.type === "paperHeader") return null
  const turn = (choice: (typeof TURNS)[number]) => {
    if (choice.section) ensureCvSection(editor, choice.section, block.id)
    try {
      editor.setTextCursorPosition(block.id, "start")
      changeBlockType(editor, choice.target)
    } catch {
      editor.updateBlock(block.id, {
        type: choice.target.type,
        props: choice.target.props ?? {},
      })
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Block menu"
            className="size-11 md:size-6"
          >
            <Ellipsis className="size-3.5" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent className="w-[232px]">
        <p className="px-2 py-1 text-xs text-muted-foreground">Turn into</p>
        {TURNS.map((choice) => (
          <DropdownMenuItem key={choice.label} onClick={() => turn(choice)}>
            {choice.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => duplicateCvBlock(editor)}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => editor.moveBlocksUp(block.id)}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => editor.moveBlocksDown(block.id)}>
          Move down
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => editor.removeBlocks([block.id])}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
