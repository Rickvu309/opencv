import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"

/** Title names the thing. The body says it is final. The button repeats the verb. */
function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  thing,
  confirmLabel,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  thing: string
  confirmLabel: string
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent data-slot="confirm-delete" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete {thing}?</DialogTitle>
          <DialogDescription>This can't be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDelete }
