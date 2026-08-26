import { useState } from "react"
import { SquarePen, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { DestructiveCommandDialog } from "@/features/commands/destructive-command-dialog.tsx"

type Props = {
  onNewThread: () => void
  threadTitle?: string | null
  onDeleteThread?: () => void
}

export function ThreadTopBar({
  onNewThread,
  threadTitle,
  onDeleteThread,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <header className="flex shrink-0 items-center justify-end gap-1 px-4 pt-3 pb-1">
      {onDeleteThread ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" />
          Delete Thread
        </Button>
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={onNewThread}>
        <SquarePen className="size-4" />
        New Thread
      </Button>
      {confirmOpen ? (
        <DestructiveCommandDialog
          open
          title="Delete Thread"
          name={threadTitle ?? null}
          onOpenChange={setConfirmOpen}
          onConfirm={() => onDeleteThread?.()}
        />
      ) : null}
    </header>
  )
}
