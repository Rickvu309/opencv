import { useState } from "react"
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

export function RichDocumentMenu({
  session,
  status,
  blocked,
}: {
  session: ReturnType<typeof openRichPaperSession> | null
  status: SyncStatus
  blocked: boolean
}) {
  const [preparing, setPreparing] = useState(false)
  const available = session && status === "saved" && !blocked && !preparing
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
          onClick={async () => {
            if (!available) return
            setPreparing(true)
            try {
              await session.downloadWord()
            } catch {
              if (session.ready())
                toast.error(
                  "Word download stopped. Wait until your changes are saved and try again."
                )
            } finally {
              setPreparing(false)
            }
          }}
        >
          <Download />
          {preparing ? "Preparing Word…" : "Download Word"}
        </DropdownMenuItem>
        {status !== "saved" || blocked ? (
          <p className="max-w-56 px-2 py-1.5 text-xs text-muted-foreground">
            Word download is available when your changes are saved.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
