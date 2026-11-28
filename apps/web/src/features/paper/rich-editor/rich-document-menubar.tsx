import { useEffect, useReducer } from "react"
import { BetweenHorizontalStart, Link, Redo2, Undo2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { openRichPaperSession } from "@/lib/paper-rich.ts"
import type { SyncStatus } from "@/lib/paper-sync-status.ts"
import {
  RichFindMenuItems,
  RichPageSetupMenuEntry,
  useRichDownloadWordItem,
} from "./rich-document-menu.tsx"
import { RichPageSetup } from "./rich-page-setup.tsx"
import type { TextEditor } from "./rich-text-toolbar-control.tsx"

export function RichDocumentMenuBar({
  editor,
  session,
  status,
  blocked,
  onFind,
}: {
  editor: TextEditor | null
  session: Pick<ReturnType<typeof openRichPaperSession>, "downloadWord"> | null
  status: SyncStatus
  blocked: boolean
  onFind?: (mode: "find" | "replace") => void
}) {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => editor?.subscribe(refresh), [editor])
  const history = editor?.documentHistory()
  const canLink = editor?.formattingState()?.canLink
  const editDisabled = !editor || blocked
  const downloadItem = useRichDownloadWordItem({
    session,
    status,
    blocked,
    editorAvailable: !!editor,
  })
  return (
    <div
      data-paper-menu-row=""
      role="group"
      aria-label="Document menus"
      className="hidden shrink-0 items-center gap-1 border-b px-5 py-1 md:flex"
    >
      <RichPageSetup editor={editor} blocked={blocked}>
        {(openSetup) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="touch" className="px-2">
                  File
                </Button>
              }
            />
            <DropdownMenuContent align="start" data-surface="paper">
              <RichPageSetupMenuEntry
                openSetup={openSetup}
                editor={editor}
                blocked={blocked}
              />
              {downloadItem}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </RichPageSetup>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="touch" className="px-2">
              Edit
            </Button>
          }
        />
        <DropdownMenuContent align="start" data-surface="paper">
          <DropdownMenuItem
            disabled={editDisabled || !history?.undo}
            onClick={() => {
              editor?.undoDocument()
              editor?.focus()
            }}
          >
            <Undo2 />
            Undo
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={editDisabled || !history?.redo}
            onClick={() => {
              editor?.redoDocument()
              editor?.focus()
            }}
          >
            <Redo2 />
            Redo
          </DropdownMenuItem>
          <RichFindMenuItems onFind={onFind} />
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="touch" className="px-2">
              Insert
            </Button>
          }
        />
        <DropdownMenuContent align="start" data-surface="paper">
          <DropdownMenuItem
            disabled={editDisabled || !canLink}
            onClick={() => {
              document.dispatchEvent(new Event("paper-edit-link"))
              editor?.focus()
            }}
          >
            <Link />
            Link
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editor || blocked || !editor.canInsertPageBreak()}
            onClick={() => {
              editor?.apply(() => editor.insertPageBreak())
              editor?.focus()
            }}
          >
            <BetweenHorizontalStart />
            Page break
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
