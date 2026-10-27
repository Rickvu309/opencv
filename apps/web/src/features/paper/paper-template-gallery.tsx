import { useLayoutEffect, useMemo, useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { MiniCv } from "./paper-parts.tsx"
import { PAPER_TEMPLATE_LABELS, previewTemplate } from "./paper-templates.ts"

/** Wide on `sm` and up, and always scrolls inside the viewport. */
export const PAPER_GALLERY_DIALOG_CLASS =
  "max-h-[90vh] overflow-y-auto sm:max-w-3xl"

export function PaperTemplateGallery({
  onUse,
  onImport,
}: {
  onUse: (templateId: string) => void
  onImport?: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState("simple")
  useLayoutEffect(() => {
    // New switches to the gallery in its own state, so the parent dialog
    // can still be the narrow default when this mounts.
    const dialog = rootRef.current?.closest("[data-slot='dialog-content']")
    if (!(dialog instanceof HTMLElement)) return
    dialog.classList.remove("sm:max-w-sm")
    dialog.classList.add("max-h-[90vh]", "overflow-y-auto", "sm:max-w-3xl")
  })
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return PAPER_TEMPLATE_LABELS
    return PAPER_TEMPLATE_LABELS.filter((item) =>
      item.label.toLowerCase().includes(needle)
    )
  }, [query])
  const current =
    PAPER_TEMPLATE_LABELS.find((item) => item.id === selected) ??
    PAPER_TEMPLATE_LABELS[0]!

  return (
    <div ref={rootRef} className="@container flex flex-col gap-4">
      <Input
        aria-label="Search templates"
        placeholder="Search templates"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        data-template-gallery=""
        className="grid grid-cols-1 items-start gap-4 @min-[391px]:grid-cols-2"
      >
        <div
          data-template-list=""
          className="flex min-w-0 flex-col gap-2 @min-[391px]:flex-row @min-[391px]:flex-wrap"
        >
          <Button
            type="button"
            size="sm"
            variant={query === "" ? "secondary" : "outline"}
            onClick={() => setQuery("")}
          >
            All
          </Button>
          {filtered.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={item.id === selected ? "secondary" : "outline"}
              onClick={() => setSelected(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div
          aria-label="Template preview"
          data-template={previewTemplate(current.id)}
          className="max-h-80 overflow-clip rounded-lg border border-border bg-muted/40 p-3"
        >
          <MiniCv templateId={current.id} />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onImport ? (
          <Button type="button" variant="ghost" onClick={onImport}>
            Import a file
          </Button>
        ) : null}
        <Button type="button" variant="glow" onClick={() => onUse(current.id)}>
          Use template
        </Button>
      </div>
    </div>
  )
}
