"use client"

import * as React from "react"
import type { Popover as BasePopover } from "@base-ui/react/popover"
import { useRender } from "@base-ui/react/use-render"
import {
  Popover as PopoverRoot,
  PopoverContent as PopoverPopup,
  PopoverDescription as PopoverText,
  PopoverTitle as PopoverHeading,
  PopoverTrigger as PopoverButton,
} from "@ui-sdk/react/popover"
import { cn } from "cn"
import { PopupContainerContext } from "../lib/popup-container"
import { popoverAlignment, popoverCoordinate } from "../lib/popover-alignment"

type FocusTarget = BasePopover.Popup.Props["initialFocus"]
type Interaction = "mouse" | "touch" | "pen" | "keyboard"

const FocusContext = React.createContext<{
  trigger: React.RefObject<HTMLButtonElement | null>
  setTrigger: React.RefCallback<HTMLButtonElement>
  interaction: React.RefObject<Interaction>
} | null>(null)

function Popover({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof PopoverRoot>) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const interactionRef = React.useRef<Interaction>("keyboard")
  const setTrigger = React.useCallback((element: HTMLButtonElement | null) => {
    triggerRef.current = element
  }, [])
  return (
    <FocusContext
      value={{ trigger: triggerRef, setTrigger, interaction: interactionRef }}
    >
      <PopoverRoot
        {...props}
        onOpenChange={(open, details) => {
          interactionRef.current =
            details.source === "mouse" ||
            details.source === "touch" ||
            details.source === "pen"
              ? details.source
              : "keyboard"
          onOpenChange?.(open, details)
        }}
      />
    </FocusContext>
  )
}

function PopoverTriggerElement({
  render,
  buttonProps,
  state,
}: {
  render: React.ComponentProps<typeof PopoverButton>["render"]
  buttonProps: React.ComponentPropsWithRef<"button">
  state: { open: boolean; disabled: boolean }
}) {
  return useRender({
    defaultTagName: "button",
    render,
    state,
    props: { ...buttonProps, "data-popup-open": state.open ? "" : undefined },
  })
}

function PopoverTrigger({
  ref,
  render,
  ...props
}: React.ComponentProps<typeof PopoverButton>) {
  const focus = React.useContext(FocusContext)
  return (
    <PopoverButton
      data-slot="popover-trigger"
      render={(buttonProps, state) => (
        <PopoverTriggerElement
          render={render}
          buttonProps={buttonProps}
          state={state}
        />
      )}
      ref={(element) => {
        focus?.setTrigger(element)
        if (typeof ref === "function") return ref(element)
        if (ref) ref.current = element
      }}
      {...props}
    />
  )
}

function PopoverContent({
  ref,
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  collisionPadding = 8,
  initialFocus,
  finalFocus,
  ...props
}: Omit<
  React.ComponentProps<typeof PopoverPopup>,
  "initialFocus" | "finalFocus"
> &
  Pick<BasePopover.Popup.Props, "initialFocus" | "finalFocus">) {
  const focus = React.useContext(FocusContext)
  const container = React.useRef<HTMLDivElement>(null)
  const [popup, setPopup] = React.useState<HTMLDivElement | null>(null)
  const [collisionAlign, setCollisionAlign] = React.useState(align)
  const setContainer = React.useCallback(
    (element: HTMLDivElement | null) => {
      container.current = element
      setPopup(element)
      if (typeof ref === "function") return ref(element)
      if (ref) ref.current = element
    },
    [ref]
  )
  React.useLayoutEffect(() => {
    const view = popup?.ownerDocument.defaultView
    if (!popup || !view) return
    const update = () => {
      for (const axis of ["left", "top"] as const) {
        const coordinate = Number.parseFloat(popup.style[axis])
        if (!Number.isFinite(coordinate)) continue
        const rounded = `${popoverCoordinate(coordinate, view.devicePixelRatio || 1)}px`
        if (popup.style[axis] !== rounded) popup.style[axis] = rounded
      }
    }
    const observer = new MutationObserver(update)
    observer.observe(popup, { attributes: true, attributeFilter: ["style"] })
    update()
    return () => observer.disconnect()
  }, [popup])
  React.useLayoutEffect(() => {
    const trigger = focus?.trigger.current
    if (!popup || !trigger || props.anchor) return
    const view = popup.ownerDocument.defaultView
    if (!view) return
    const update = () => {
      const rect = trigger.getBoundingClientRect()
      const vertical = side === "top" || side === "bottom"
      const viewport = view.visualViewport
      setCollisionAlign(
        popoverAlignment({
          align,
          start: vertical ? rect.x : rect.y,
          anchorSize: vertical ? rect.width : rect.height,
          popupSize: vertical ? popup.offsetWidth : popup.offsetHeight,
          viewportStart:
            (vertical ? viewport?.offsetLeft : viewport?.offsetTop) ?? 0,
          viewportSize: vertical
            ? (viewport?.width ??
              popup.ownerDocument.documentElement.clientWidth)
            : (viewport?.height ??
              popup.ownerDocument.documentElement.clientHeight),
          offset: alignOffset,
          padding: collisionPadding,
          reverse:
            vertical && view.getComputedStyle(trigger).direction === "rtl",
        })
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(trigger)
    observer.observe(popup)
    view.addEventListener("resize", update)
    view.addEventListener("scroll", update, true)
    view.visualViewport?.addEventListener("resize", update)
    view.visualViewport?.addEventListener("scroll", update)
    return () => {
      observer.disconnect()
      view.removeEventListener("resize", update)
      view.removeEventListener("scroll", update, true)
      view.visualViewport?.removeEventListener("resize", update)
      view.visualViewport?.removeEventListener("scroll", update)
    }
  }, [
    popup,
    focus?.trigger,
    props.anchor,
    align,
    side,
    alignOffset,
    collisionPadding,
  ])
  const resolveFocus = (target: FocusTarget, closing: boolean) => {
    if (typeof target === "function") {
      return () => {
        const result = target(focus?.interaction.current ?? "keyboard")
        if (result === true || result === null)
          return closing ? focus?.trigger.current : undefined
        if (result instanceof HTMLElement) return result
        const active = focus?.trigger.current?.ownerDocument.activeElement
        return active instanceof HTMLElement ? active : undefined
      }
    }
    if (target === false) return "none"
    if (target === true || target === undefined)
      return closing ? "trigger" : "auto"
    return () => target.current
  }
  return (
    <PopupContainerContext value={container}>
      <PopoverPopup
        ref={setContainer}
        container={focus?.trigger.current?.ownerDocument.body}
        data-slot="popover-content"
        align={props.anchor ? align : collisionAlign}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        initialFocus={resolveFocus(initialFocus, false)}
        finalFocus={resolveFocus(finalFocus, true)}
        className={cn(
          "isolate z-50 flex w-72 motion-pop flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden data-closed:pointer-events-none",
          className
        )}
        {...props}
      />
    </PopupContainerContext>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({
  className,
  ...props
}: React.ComponentProps<typeof PopoverHeading>) {
  return (
    <PopoverHeading
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<typeof PopoverText>) {
  return (
    <PopoverText
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
