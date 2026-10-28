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
        overlayClassName="bg-black/18 supports-backdrop-filter:backdrop-blur-none"
        className="top-[300px] w-[380px] translate-y-0 gap-0 rounded-[10px] bg-card px-5 pt-5 pb-4 shadow-[0_2px_4px_rgb(0_0_0/0.06),0_24px_60px_rgb(0_0_0/0.14)] ring-foreground/6 sm:max-w-none md:left-[calc(50%+118px)]"
      >
        <DialogTitle className="text-[15px] leading-normal font-semibold text-foreground">
          Delete {title}?
        </DialogTitle>
        <DialogDescription className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
          This can't be undone.
        </DialogDescription>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-[30px] rounded-md px-3 text-[13px] font-normal text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-[30px] gap-1.5 rounded-md bg-foreground/91 px-3 text-[13px] font-semibold text-card ring-0 hover:bg-foreground"
            onClick={onDelete}
          >
            Delete job
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
