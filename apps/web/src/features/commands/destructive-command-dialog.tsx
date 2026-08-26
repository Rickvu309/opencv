import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { destructiveConfirmDescription } from "@/features/commands/destructive-confirm-copy.ts"

type Props = {
  open: boolean
  title: string
  name: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * Shared confirm step for User-fired destructive Commands (ADR-0003).
 * Dismiss — Cancel, overlay, or close — must not run the Command.
 */
export function DestructiveCommandDialog({
  open,
  title,
  name,
  onOpenChange,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {destructiveConfirmDescription(name)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
