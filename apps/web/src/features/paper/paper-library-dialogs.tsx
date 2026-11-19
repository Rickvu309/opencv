import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"

export function PaperRenameDialog({
  open,
  name,
  error,
  onNameChange,
  onSave,
  onClose,
}: {
  open: boolean
  name: string
  error: string | null
  onNameChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>Name is required.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSave()
          }}
        >
          <Input
            aria-label="Name"
            className="h-11 text-base md:h-8 md:text-sm"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "paper-rename-error" : undefined}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
          {error ? (
            <p
              id="paper-rename-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              size="touch"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="h-11 md:h-7"
              type="submit"
              size="sm"
              variant="primary"
            >
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PaperDeleteDialog({
  open,
  name,
  undoable,
  onDelete,
  onClose,
}: {
  open: boolean
  name: string | null
  undoable: boolean
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      {name === null ? null : (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{`Delete "${name}"?`}</DialogTitle>
            <DialogDescription>
              {undoable
                ? "You can undo this from the message that follows."
                : "This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              className="h-11 md:h-7"
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="h-11 md:h-7"
              type="button"
              size="sm"
              variant="destructive"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
