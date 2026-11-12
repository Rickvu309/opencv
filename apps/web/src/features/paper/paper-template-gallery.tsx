import { useMemo, useReducer } from "react"

import type { PaperTemplateId } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { MiniCv } from "./paper-parts.tsx"
import { PAPER_TEMPLATE_LABELS, previewTemplate } from "./paper-templates.ts"

export const PAPER_GALLERY_DIALOG_CLASS =
  "max-h-[90vh] overflow-y-auto sm:max-w-3xl"

type GalleryState = { query: string; selected: PaperTemplateId }

type GalleryAction =
  | { type: "query_typed"; query: string }
  | { type: "query_cleared" }
  | { type: "template_picked"; id: PaperTemplateId }

function galleryReducer(
  state: GalleryState,
  action: GalleryAction
): GalleryState {
  switch (action.type) {
    case "query_typed":
      return { ...state, query: action.query }
    case "query_cleared":
      return { ...state, query: "" }
    case "template_picked":
      return { ...state, selected: action.id }
  }
}

export function PaperTemplateGallery({
  onUse,
  onImport,
  onBlank,
  pending = false,
}: {
  onUse: (templateId: PaperTemplateId) => void
  onImport?: () => void
  onBlank?: () => void
  pending?: boolean
}) {
  const [{ query, selected }, dispatch] = useReducer(galleryReducer, {
    query: "",
    selected: "simple",
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
    <div className="@container flex flex-col gap-4">
      <Input
        aria-label="Search templates"
        placeholder="Search templates"
        value={query}
        onChange={(event) =>
          dispatch({ type: "query_typed", query: event.target.value })
        }
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
            className="h-11 md:h-7"
            type="button"
            size="sm"
            variant={query === "" ? "secondary" : "outline"}
            onClick={() => dispatch({ type: "query_cleared" })}
          >
            All
          </Button>
          {filtered.map((item) => (
            <Button
              className="h-11 md:h-7"
              key={item.id}
              type="button"
              size="sm"
              variant={item.id === selected ? "secondary" : "outline"}
              onClick={() => dispatch({ type: "template_picked", id: item.id })}
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
        {onBlank ? (
          <Button
            className="h-11 md:h-8"
            type="button"
            variant="outline"
            onClick={onBlank}
            disabled={pending}
          >
            Start blank
          </Button>
        ) : null}
        {onImport ? (
          <Button
            className="h-11 md:h-8"
            type="button"
            variant="ghost"
            onClick={onImport}
          >
            Import a file
          </Button>
        ) : null}
        <Button
          className="h-11 md:h-7"
          type="button"
          size="sm"
          variant="primary"
          onClick={() => onUse(current.id)}
          disabled={pending}
        >
          Use template
        </Button>
      </div>
    </div>
  )
}
