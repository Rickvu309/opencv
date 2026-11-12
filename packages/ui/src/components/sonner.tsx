import type { ComponentProps, CSSProperties } from "react"
import { Toaster as Sonner, toast } from "sonner"
import { cn } from "cn"
import {
  TOAST_CORNER_ON_PHONES_PX,
  TOAST_CORNER_PX,
  TOAST_WIDTH_PX,
  toastMaxWidth,
  toastOffsetBottom,
  toastOffsetRight,
} from "@workspace/ui/lib/toast-offset"

const clearOfBottomChrome = {
  bottom: toastOffsetBottom(TOAST_CORNER_PX),
  right: toastOffsetRight(TOAST_CORNER_PX),
}
const clearOfBottomChromeOnPhones = {
  bottom: toastOffsetBottom(TOAST_CORNER_ON_PHONES_PX),
}

const narrowsToTheRoomItIsGiven = {
  "--width": toastMaxWidth(TOAST_WIDTH_PX),
} as CSSProperties

const glidesWithPanels =
  "transition-[bottom,right,transform]! duration-(--duration-panel)! ease-(--ease-panel)! motion-reduce:transition-none!"

function Toaster({
  className,
  style,
  ...props
}: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      data-slot="toaster"
      className={cn("toaster group", glidesWithPanels, className)}
      style={{ ...narrowsToTheRoomItIsGiven, ...style }}
      offset={clearOfBottomChrome}
      mobileOffset={clearOfBottomChromeOnPhones}
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
