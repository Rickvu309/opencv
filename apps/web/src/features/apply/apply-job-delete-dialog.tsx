import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { ApplyColumnAnchor } from "./apply-column-anchor.tsx"

export function DeleteJobDialog({
  open,
  title,
  onOpenChange,
  onDelete,
}: {
  open: boolean
  title: string
  onOpenChange: (open: boolean) => void
  onDelete: () => void
}) {
  return (
    <>
      <ApplyColumnAnchor />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-slot="confirm-delete"
          showCloseButton={false}
          className="sm:max-w-[420px]"
        >
          <DialogTitle>Delete {title}?</DialogTitle>
          <DialogDescription>This can't be undone.</DialogDescription>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 md:h-7"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-11 md:h-7"
              onClick={onDelete}
            >
              Delete job
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
