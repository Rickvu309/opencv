import type { ComponentProps } from "react"
import { Toaster as Sonner, toast } from "sonner"
import { cn } from "cn"

/** One toaster for the app. Undo is an action on the toast, not a second toast. */
function Toaster({ className, ...props }: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      data-slot="toaster"
      className={cn("toaster group", className)}
      toastOptions={{
        classNames: {
          toast:
            "group toast border-border bg-popover text-popover-foreground shadow-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

function toastWithUndo(message: string, onUndo: () => void) {
  return toast(message, {
    action: {
      label: "Undo",
      onClick: onUndo,
    },
  })
}

export { Toaster, toast, toastWithUndo }
