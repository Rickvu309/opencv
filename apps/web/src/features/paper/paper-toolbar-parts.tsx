import type { ReactNode, RefObject } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown, MoreHorizontal } from "lucide-react"

export function ToolbarRoot({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-1 overflow-x-auto rounded-lg border border-border bg-background px-2 py-1.5 shadow-sm",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {children}
    </div>
  )
}

export function ToolbarZone({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {children}
    </div>
  )
}

export function ToolbarSpacer() {
  return <span className="min-w-2 flex-1" aria-hidden />
}

export function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
}

export function ToolbarMeta({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "shrink-0 px-2 text-xs text-muted-foreground tabular-nums",
        className
      )}
    >
      {children}
    </span>
  )
}

export function ToolbarButton({
  label,
  onMouseDown,
  onClick,
  children,
  active,
  className,
}: {
  label: string
  onMouseDown?: () => void
  onClick?: () => void
  children: ReactNode
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => {
        if (onMouseDown) {
          e.preventDefault()
          onMouseDown()
        }
      }}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

export type MenuItem = {
  id: string
  label: string
  hint?: string
  icon?: ReactNode
  disabled?: boolean
}

export type MenuSection = {
  label?: string
  items: MenuItem[]
}

function useDismissOnOutside(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  panelSelector: string,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (rootRef.current?.contains(target) || target.closest(panelSelector)) {
        return
      }
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose, panelSelector, rootRef])
}

function ToolbarDropdownPanel({
  open,
  mounted,
  pos,
  align,
  children,
  className,
  panelId,
}: {
  open: boolean
  mounted: boolean
  pos: { top: number; left: number }
  align: "start" | "end"
  children: ReactNode
  className?: string
  panelId: string
}) {
  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      id={panelId}
      data-toolbar-dropdown
      role="menu"
      className={cn(
        "fixed z-50 min-w-[11rem] rounded-xl border border-border bg-popover p-1 shadow-lg transition-opacity",
        mounted ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        top: pos.top,
        left: pos.left,
        transform: align === "end" ? "translateX(-100%)" : undefined,
      }}
    >
      {children}
    </div>,
    document.body
  )
}

function MenuItemButton({
  item,
  onSelect,
}: {
  item: MenuItem
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => onSelect(item.id)}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted",
        item.disabled && "pointer-events-none opacity-50"
      )}
    >
      {item.icon ? (
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {item.icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-xs font-medium">{item.label}</span>
        {item.hint ? (
          <span className="block text-[11px] leading-snug text-muted-foreground">
            {item.hint}
          </span>
        ) : null}
      </span>
    </button>
  )
}

function useDropdownPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelWidth: number,
  align: "start" | "end"
) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    if (!open) {
      setMounted(false)
      return
    }

    function updatePosition() {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const gap = 6
      const left =
        align === "end"
          ? rect.right
          : Math.min(rect.left, window.innerWidth - panelWidth - gap)
      setPos({ top: rect.bottom + gap, left: Math.max(gap, left) })
      setMounted(true)
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open, anchorRef, panelWidth, align])

  return { pos, mounted }
}

export function ToolbarMenu({
  label,
  shortLabel,
  icon,
  items,
  onSelect,
  className,
  align = "start",
  hideLabel,
  panelClassName,
}: {
  label: string
  shortLabel?: string
  icon?: ReactNode
  items: MenuItem[]
  onSelect: (id: string) => void
  className?: string
  align?: "start" | "end"
  hideLabel?: boolean
  panelClassName?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const panelId = `toolbar-menu-${label.replace(/\s+/g, "-").toLowerCase()}`
  const { pos, mounted } = useDropdownPosition(open, anchorRef, 220, align)

  useDismissOnOutside(open, rootRef, "[data-toolbar-dropdown]", () =>
    setOpen(false)
  )

  function handleSelect(id: string) {
    onSelect(id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={anchorRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? panelId : undefined}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground",
          className
        )}
      >
        {icon}
        {hideLabel ? (
          <span className="sr-only">{label}</span>
        ) : shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
        <ChevronDown
          className={cn(
            "size-3 opacity-60 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      <ToolbarDropdownPanel
        open={open}
        mounted={mounted}
        pos={pos}
        align={align}
        panelId={panelId}
        className={panelClassName}
      >
        {items.map((item) => (
          <MenuItemButton key={item.id} item={item} onSelect={handleSelect} />
        ))}
      </ToolbarDropdownPanel>
    </div>
  )
}

export function ToolbarOverflowMenu({
  sections,
  onSelect,
  align = "end",
}: {
  sections: MenuSection[]
  onSelect: (id: string) => void
  align?: "start" | "end"
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const panelId = "toolbar-overflow-menu"
  const { pos, mounted } = useDropdownPosition(open, anchorRef, 240, align)

  useDismissOnOutside(open, rootRef, "[data-toolbar-dropdown]", () =>
    setOpen(false)
  )

  function handleSelect(id: string) {
    onSelect(id)
    setOpen(false)
  }

  const flatCount = sections.reduce((n, s) => n + s.items.length, 0)
  if (flatCount === 0) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={anchorRef}
        type="button"
        aria-label="More options"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? panelId : undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground"
        )}
      >
        <MoreHorizontal className="size-4" />
      </button>
      <ToolbarDropdownPanel
        open={open}
        mounted={mounted}
        pos={pos}
        align={align}
        panelId={panelId}
        className="min-w-[13rem]"
      >
        {sections.map((section, i) => (
          <div
            key={section.label ?? i}
            className={cn(i > 0 && "mt-1 border-t border-border pt-1")}
          >
            {section.label ? (
              <p className="px-2.5 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => (
              <MenuItemButton
                key={item.id}
                item={item}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ))}
      </ToolbarDropdownPanel>
    </div>
  )
}

export function ToolbarToggle({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string
  options: { id: string; label: string; icon?: ReactNode }[]
  onChange: (id: string) => void
  ariaLabel: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex shrink-0 rounded-lg border border-border p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            value === opt.id
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

/** @deprecated Use ToolbarZone inside ToolbarRoot */
export function ToolbarGroup({
  label,
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <ToolbarZone className={className}>
      {label ? <span className="sr-only">{label}</span> : null}
      {children}
    </ToolbarZone>
  )
}

export function runEditorCommand(command: string, value?: string) {
  document.execCommand(command, false, value)
}
