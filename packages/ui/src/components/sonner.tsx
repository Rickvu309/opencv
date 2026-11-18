import type { ComponentProps, CSSProperties } from "react"
import { Toaster as Sonner, toast } from "sonner"
import { cn } from "cn"
import { CircleCheck } from "lucide-react"
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

const toastMovesOnPanelTiming =
  "transition-[transform,opacity,height]! duration-(--duration-panel)! ease-(--ease-panel)! data-[removed=true]:duration-(--duration-micro)! motion-reduce:transition-[opacity]!"

const toastRow =
  "group toast flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-popover py-1.5 pr-1.5 pl-3 text-[13px] text-popover-foreground shadow-lg data-[mounted=false]:pointer-events-none data-[removed=true]:pointer-events-none"

const toastIcon =
  "flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4"

const toastTextButton =
  "inline-flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-md px-2 text-[13px] font-medium transition-colors duration-(--duration-micro) ease-(--ease-micro) outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-md:h-11 max-md:min-w-11"

const toastClose =
  "order-last inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-(--duration-micro) ease-(--ease-micro) outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-md:size-11 [&>svg]:size-3.5"

function Toaster({
  className,
  style,
  ...props
}: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      data-slot="toaster"
      theme="light"
      className={cn("toaster group", glidesWithPanels, className)}
      style={{ ...narrowsToTheRoomItIsGiven, ...style }}
      offset={clearOfBottomChrome}
      mobileOffset={clearOfBottomChromeOnPhones}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(toastRow, toastMovesOnPanelTiming),
          icon: toastIcon,
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-[13px] leading-snug font-medium",
          description: "text-xs text-muted-foreground",
          actionButton: cn(toastTextButton, "text-foreground"),
          cancelButton: cn(toastTextButton, "text-muted-foreground"),
          closeButton: toastClose,
        },
      }}
      {...props}
    />
  )
}

function toastWithUndo(message: string, onUndo: () => void) {
  return toast(message, {
    icon: <CircleCheck aria-hidden="true" />,
    action: {
      label: "Undo",
      onClick: onUndo,
    },
  })
}

export { Toaster, toast, toastWithUndo }
