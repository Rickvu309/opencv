import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@workspace/ui/components/button"
import { XIcon } from "lucide-react"
import {
  openingFocusTarget,
  wrappedTabStop,
} from "@workspace/ui/lib/dialog-tab-stops"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  instant = false,
  enterOnMount = false,
  ...props
}: DialogPrimitive.Backdrop.Props & {
  instant?: boolean
  enterOnMount?: boolean
}) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-foreground/10 data-closed:pointer-events-none",
        !instant && "motion-backdrop",
        className
      )}
      {...props}
      {...(enterOnMount ? { "data-starting-style": "" } : {})}
    />
  )
}

type DialogLayout = "dialog" | "sheet"

const DIALOG_LAYOUT_CLASS: Record<DialogLayout, string> = {
  dialog:
    "fixed top-[clamp(16px,14dvh,120px)] left-1/2 z-50 grid max-h-[calc(100dvh-clamp(16px,14dvh,120px)-16px)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 gap-4 overflow-y-auto rounded-[12px] bg-popover p-6 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm",
  sheet:
    "fixed z-50 bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none",
}

type DialogSide = "start" | "end"

function dialogMotion(
  layout: DialogLayout,
  side: DialogSide,
  instant: boolean
) {
  if (instant) return undefined
  if (layout === "sheet")
    return side === "end" ? "motion-sheet-end" : "motion-sheet-start"
  return "motion-modal"
}

function useEnterOnMount(enabled: boolean) {
  const [starting, setStarting] = React.useState(enabled)
  React.useLayoutEffect(() => {
    if (!starting) return
    const frame = requestAnimationFrame(() => setStarting(false))
    return () => cancelAnimationFrame(frame)
  }, [starting])
  return enabled && starting
}

function keepTabInside(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab" || event.defaultPrevented) return
  const next = wrappedTabStop(
    event.currentTarget,
    event.currentTarget.ownerDocument.activeElement,
    event.shiftKey
  )
  if (!next) return
  event.preventDefault()
  next.focus()
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  layout = "dialog",
  side = "start",
  instant = false,
  onKeyDown,
  ref,
  initialFocus,
  ...props
}: DialogPrimitive.Popup.Props & {
  ref?: React.Ref<HTMLDivElement>
  showCloseButton?: boolean
  overlayClassName?: string
  layout?: DialogLayout
  side?: DialogSide
  instant?: boolean
}) {
  const enterOnMount = useEnterOnMount(layout === "sheet" && !instant)
  const popupRef = React.useRef<HTMLDivElement | null>(null)
  const attachPopup = React.useCallback(
    (node: HTMLDivElement | null) => {
      popupRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )
  return (
    <DialogPortal>
      <DialogOverlay
        className={overlayClassName}
        instant={instant}
        enterOnMount={enterOnMount}
      />
      <DialogPrimitive.Popup
        ref={attachPopup}
        initialFocus={
          initialFocus ??
          (() => popupRef.current && openingFocusTarget(popupRef.current))
        }
        data-slot="dialog-content"
        data-layout={layout}
        data-side={layout === "sheet" ? side : undefined}
        className={cn(
          DIALOG_LAYOUT_CLASS[layout],
          "data-closed:pointer-events-none",
          dialogMotion(layout, side, instant),
          showCloseButton && layout === "dialog" && "pt-2",
          className
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          keepTabInside(event)
        }}
        {...props}
        {...(enterOnMount ? { "data-starting-style": "" } : {})}
      >
        {children}
        {showCloseButton && (
          <div
            data-slot="dialog-close-pin"
            className="pointer-events-none sticky top-2 z-10 order-first flex h-0 justify-end"
          >
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  className="pointer-events-auto absolute top-1 -right-3 bg-popover max-md:-top-0.5 max-md:-right-[18px] max-md:size-11"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-[12px] border-t bg-muted/50 px-6 py-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-sm leading-snug font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-[13px] text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  DIALOG_LAYOUT_CLASS,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DialogLayout,
}
