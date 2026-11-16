import { useId, useReducer, useRef } from "react"
import { Download, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu"
import type { openRichPaperSession } from "@/lib/paper-rich.ts"
import type { SyncStatus } from "@/lib/paper-sync.ts"
import { SavedRichWordChanged } from "@/lib/paper-rich-word.ts"

export function RichDocumentMenu({
  session,
  status,
  blocked,
}: {
  session: Pick<ReturnType<typeof openRichPaperSession>, "downloadWord"> | null
  status: SyncStatus
  blocked: boolean
}) {
  const hintId = useId()
  const inFlight = useRef(false)
  const [preparing, dispatch] = useReducer(
    (_: boolean, action: "prepare" | "finish") => action === "prepare",
    false
  )
  const available = session && status === "saved" && !blocked && !preparing
  const hint =
    blocked || !session || status === "refused" || status === "stuck"
      ? "Paper couldn't prepare the Word file. Reload the page and try again."
      : status !== "saved"
        ? "Wait until your changes are saved."
        : undefined
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:size-8"
            aria-label="Document menu"
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!available}
          aria-describedby={hint ? hintId : undefined}
          onClick={async () => {
            if (!available || inFlight.current) return
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
