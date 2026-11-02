import { useCallback, useEffect, useRef } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import {
  clampSidebarWidth,
  COLLAPSED_GUTTER,
  isCollapseDrag,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_KEY_STEP,
} from "@/features/app-shell/sidebar-width.ts"

type Props = {
  width: number
  onCommit: (width: number) => void
  onCollapse: () => void
  onToggle: () => void
  onReset: () => void
}

type Drag = {
  handle: HTMLElement
  frame: HTMLElement | null
  aside: HTMLElement | null
  startX: number
  startWidth: number
  raw: number
  raf: number
}

function showWidth(drag: Drag, width: number) {
  const collapsing = isCollapseDrag(drag.raw)
  const frameWidth = collapsing ? COLLAPSED_GUTTER : width
  drag.frame?.style.setProperty("width", `${frameWidth}px`)
  drag.aside?.style.setProperty("width", `${width}px`)
  if (collapsing) drag.frame?.setAttribute("data-collapse-preview", "true")
  else drag.frame?.removeAttribute("data-collapse-preview")
  drag.handle.setAttribute("aria-valuenow", String(Math.round(width)))
}

function clearInlineWidths(drag: Drag) {
  drag.frame?.style.removeProperty("width")
  drag.aside?.style.removeProperty("width")
  drag.frame?.removeAttribute("data-collapse-preview")
  drag.frame?.removeAttribute("data-resizing")
}

function releaseDocument() {
  document.body.style.removeProperty("user-select")
  document.body.style.removeProperty("cursor")
}

export function SidebarResizeHandle({
  width,
  onCommit,
  onCollapse,
  onToggle,
  onReset,
}: Props) {
  const dragRef = useRef<Drag | null>(null)

  const abandonDrag = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    cancelAnimationFrame(drag.raf)
    clearInlineWidths(drag)
    drag.handle.setAttribute(
      "aria-valuenow",
      String(Math.round(drag.startWidth))
    )
    releaseDocument()
  }, [])

  useEffect(() => {
    window.addEventListener("blur", abandonDrag)
    return () => {
      window.removeEventListener("blur", abandonDrag)
      abandonDrag()
    }
  }, [abandonDrag])

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const frame = handle.closest<HTMLElement>('[data-slot="sidebar-frame"]')
    frame?.setAttribute("data-resizing", "true")
    dragRef.current = {
      handle,
      frame,
      aside: frame?.querySelector<HTMLElement>(":scope > aside") ?? null,
      startX: event.clientX,
      startWidth: width,
      raw: width,
      raf: 0,
    }
    document.body.style.setProperty("user-select", "none")
    document.body.style.setProperty("cursor", "col-resize")
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    drag.raw = drag.startWidth + event.clientX - drag.startX
    if (drag.raf) return
    drag.raf = requestAnimationFrame(() => {
      drag.raf = 0
      showWidth(drag, clampSidebarWidth(drag.raw))
    })
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    if (drag.handle.hasPointerCapture(event.pointerId)) {
      drag.handle.releasePointerCapture(event.pointerId)
    }
    cancelAnimationFrame(drag.raf)
    clearInlineWidths(drag)
    releaseDocument()
    if (isCollapseDrag(drag.raw)) {
      drag.handle.setAttribute(
        "aria-valuenow",
        String(Math.round(drag.startWidth))
      )
      onCollapse()
      return
    }
    const next = clampSidebarWidth(drag.raw)
    drag.handle.setAttribute("aria-valuenow", String(Math.round(next)))
    onCommit(next)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      onCommit(width - SIDEBAR_KEY_STEP)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      onCommit(width + SIDEBAR_KEY_STEP)
    } else if (event.key === "Enter") {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={shellCopy.resizeSidebar}
      aria-valuenow={Math.round(width)}
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      tabIndex={0}
      data-slot="sidebar-resize-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={abandonDrag}
      onLostPointerCapture={abandonDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cn(
        FOCUS_RING,
        "absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-transparent after:transition-colors after:duration-(--duration-micro) after:ease-(--ease-micro) hover:after:bg-sidebar-ring hover:after:delay-(--duration-micro) focus-visible:after:bg-sidebar-ring active:after:bg-sidebar-ring"
      )}
    />
  )
}
