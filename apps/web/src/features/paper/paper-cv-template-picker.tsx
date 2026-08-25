import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@workspace/ui/lib/utils"
import { Check, ChevronDown, LayoutTemplate } from "lucide-react"

import {
  CV_TEMPLATES,
  type CvData,
  type CvTemplateId,
} from "./paper-cv-types.ts"

type Props = {
  value: CvTemplateId
  onChange: (id: CvTemplateId) => void
}

export function CvTemplateDropdown({ value, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const active = CV_TEMPLATES.find((t) => t.id === value)

  useLayoutEffect(() => {
    if (!open) {
      setMounted(false)
      return
    }

    function updatePosition() {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const panelWidth = 352
      const gap = 6
      const left = Math.min(rect.left, window.innerWidth - panelWidth - gap)
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
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (
        rootRef.current?.contains(target) ||
        target.closest("[data-cv-template-panel]")
      ) {
        return
      }
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            data-cv-template-panel
            role="listbox"
            aria-label="CV templates"
            className={cn(
              "fixed z-50 w-[22rem] rounded-xl border border-border bg-popover p-2 shadow-lg transition-opacity",
              mounted ? "opacity-100" : "opacity-0"
            )}
            style={{ top: pos.top, left: pos.left }}
          >
            <p className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Template
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {CV_TEMPLATES.map((template) => {
                const selected = template.id === value
                return (
                  <button
                    key={template.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(template.id)
                      setOpen(false)
                    }}
                    className={cn(
                      "relative flex flex-col rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50",
                      selected
                        ? "border-foreground/20 bg-muted ring-1 ring-ring/30"
                        : "border-transparent"
                    )}
                  >
                    {selected ? (
                      <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-2.5" />
                      </span>
                    ) : null}
                    <TemplateThumb id={template.id} />
                    <p className="mt-1.5 text-[11px] leading-tight font-semibold">
                      {template.name}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      {template.useCase}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className="relative">
      {panel}
      <button
        ref={anchorRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground"
        )}
      >
        <LayoutTemplate className="size-3.5" />
        <span className="max-w-[7.5rem] truncate sm:max-w-[9rem]">
          {active?.name ?? "Template"}
        </span>
        <ChevronDown
          className={cn(
            "size-3 opacity-60 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
    </div>
  )
}

function TemplateThumb({ id }: { id: CvTemplateId }) {
  if (id === "product") {
    return (
      <div className="flex h-12 overflow-hidden rounded border border-border/80 bg-white">
        <div className="w-[30%] bg-slate-800 p-1">
          <div className="mb-0.5 h-0.5 w-3/4 rounded bg-white/80" />
          <div className="h-0.5 w-full rounded bg-white/30" />
        </div>
        <div className="flex-1 p-1">
          <div className="mb-0.5 h-0.5 w-full rounded bg-muted" />
          <div className="h-0.5 w-3/5 rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (id === "service") {
    return (
      <div className="h-12 rounded border border-border/80 bg-white p-1">
        <div className="mb-1 h-1 w-2/3 rounded bg-foreground/80" />
        <div className="mb-0.5 h-0.5 w-full rounded bg-muted" />
        <div className="h-0.5 w-1/2 rounded bg-muted/60" />
      </div>
    )
  }

  if (id === "academic") {
    return (
      <div className="h-12 rounded border border-border/80 bg-white p-1">
        <div className="mb-0.5 h-0.5 w-1/2 rounded bg-foreground/70" />
        <div className="mb-1 h-0.5 w-full rounded bg-muted" />
        <div className="flex gap-0.5">
          <div className="h-1.5 flex-1 rounded bg-muted/50" />
          <div className="h-1.5 flex-1 rounded bg-muted/50" />
        </div>
      </div>
    )
  }

  if (id === "photo") {
    return (
      <div className="flex h-12 gap-1 overflow-hidden rounded border border-border/80 bg-white p-1">
        <div className="aspect-[3/4] h-full shrink-0 rounded-sm bg-muted" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <div className="h-0.5 w-3/4 rounded bg-foreground/80" />
          <div className="h-0.5 w-full rounded bg-muted" />
          <div className="h-0.5 w-2/3 rounded bg-muted/60" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-12 rounded border border-border/80 bg-white p-1 text-center">
      <div className="mx-auto mb-0.5 h-0.5 w-2/3 rounded bg-foreground/80" />
      <div className="mx-auto mb-1 h-px w-full bg-border" />
      <div className="mx-auto h-0.5 w-4/5 rounded bg-muted" />
    </div>
  )
}

export function applyCvTemplate(
  data: CvData,
  templateId: CvTemplateId
): CvData {
  return { ...data, templateId }
}
