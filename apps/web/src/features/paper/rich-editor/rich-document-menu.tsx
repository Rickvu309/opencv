import { useId, useReducer, useRef, type ReactNode } from "react"
import {
  Download,
  FileCog,
  MoreHorizontal,
  Replace,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu"
import type { openRichPaperSession } from "@/lib/paper-rich.ts"
import type { SyncStatus } from "@/lib/paper-sync-status.ts"
import { SavedRichWordChanged } from "@/lib/paper-rich-word.ts"
import { RichPageSetup } from "./rich-page-setup.tsx"
import type { TextEditor } from "./rich-text-toolbar-control.tsx"
import "./design/cv-editor.css"
import "./design/paper-floating-menus.css"

export function RichFindMenuItems({
  onFind,
}: {
  onFind?: (mode: "find" | "replace") => void
}) {
  if (!onFind) return null
  return (
    <>
      <DropdownMenuItem onClick={() => onFind("find")}>
        <Search />
        Find
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onFind("replace")}>
        <Replace />
        Find and replace
      </DropdownMenuItem>
    </>
  )
}

export function RichPageSetupMenuEntry({
  openSetup,
  editor,
  blocked,
}: {
  openSetup: () => void
  editor: TextEditor | null
  blocked: boolean
}) {
  return (
    <DropdownMenuItem disabled={!editor || blocked} onClick={openSetup}>
      <FileCog />
      Page setup
    </DropdownMenuItem>
  )
}

export function useRichDownloadWordItem({
  session,
  status,
  blocked,
  editorAvailable,
}: {
  session: Pick<ReturnType<typeof openRichPaperSession>, "downloadWord"> | null
  status: SyncStatus
  blocked: boolean
  editorAvailable: boolean
}): ReactNode {
  const hintId = useId()
  const inFlight = useRef(false)
  const [preparing, dispatch] = useReducer(
    (_: boolean, action: "prepare" | "finish") => action === "prepare",
    false
  )
  const available =
    session && status === "saved" && !blocked && editorAvailable && !preparing
  const hint =
    blocked || !session || status === "refused" || status === "stuck"
      ? "Paper couldn't prepare the Word file. Reload the page and try again."
      : !editorAvailable
        ? "The document is reloading. Please wait."
        : status !== "saved"
          ? "Wait until your changes are saved."
          : undefined
  return (
    <>
      <DropdownMenuItem
        disabled={!available}
        aria-describedby={hint ? hintId : undefined}
        onClick={async () => {
          if (!available || !session || inFlight.current) return
          inFlight.current = true
          dispatch("prepare")
          const toastId = toast.loading("Preparing Word…")
          try {
            await session.downloadWord()
            toast.success("Word file downloaded.", { id: toastId })
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError")
              toast.dismiss(toastId)
            else
              toast.error(
                error instanceof SavedRichWordChanged
                  ? "Wait until your changes are saved and try again."
                  : "Paper couldn't prepare the Word file. Try again.",
                { id: toastId }
              )
          } finally {
            inFlight.current = false
            dispatch("finish")
          }
        }}
      >
        <Download />
        {preparing ? "Preparing Word…" : "Download Word"}
      </DropdownMenuItem>
      {hint ? (
        <p
          id={hintId}
          className="max-w-56 px-2 py-1.5 text-xs text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </>
  )
}

export function RichDocumentMenu({
  session,
  onFind,
  status,
  blocked,
  editorAvailable,
  editor,
}: {
  session: Pick<ReturnType<typeof openRichPaperSession>, "downloadWord"> | null
  onFind?: (mode: "find" | "replace") => void
  status: SyncStatus
  blocked: boolean
  editorAvailable: boolean
  editor?: TextEditor | null
}) {
  const downloadItem = useRichDownloadWordItem({
    session,
    status,
    blocked,
    editorAvailable,
  })
  return (
    <RichPageSetup editor={editor ?? null} blocked={blocked}>
      {(openSetup) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 md:hidden"
                aria-label="Document menu"
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end" data-surface="paper">
            <RichFindMenuItems onFind={onFind} />
            <RichPageSetupMenuEntry
              openSetup={openSetup}
              editor={editor ?? null}
              blocked={blocked}
            />
            {downloadItem}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </RichPageSetup>
  )
}
