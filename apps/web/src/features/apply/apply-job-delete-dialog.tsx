import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/dialog"

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="confirm-delete"
        showCloseButton={false}
        className="sm:max-w-[420px] md:left-[calc(50%+118px)]"
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
  )
}
