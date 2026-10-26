import { useMemo, useState } from "react"
import { emptyCvDocument, isCvDocument } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { CvDocument } from "./paper-cv-document.tsx"
import { MiniCv } from "./paper-parts.tsx"
import {
  PAPER_TEMPLATE_LABELS,
  previewTemplate,
  printLayout,
} from "./paper-templates.ts"

export function PaperTemplateGallery({
  onUse,
  onImport,
}: {
  onUse: (templateId: string) => void
  onImport: () => void
}) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState("simple")
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
  const preview = emptyCvDocument()
  const data = isCvDocument(preview)
    ? { ...preview, templateId: printLayout(current.id) }
    : preview

  return (
    <div className="flex flex-col gap-4">
      <Input
        aria-label="Search templates"
        placeholder="Search templates"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
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
        className="max-h-80 overflow-hidden rounded-lg border border-border bg-muted/40 p-3"
      >
        <MiniCv templateId={current.id} />
        <div className="sr-only">
          <CvDocument data={data} onChange={() => undefined} />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onImport}>
          Import a file
        </Button>
        <Button type="button" variant="glow" onClick={() => onUse(current.id)}>
          Use template
        </Button>
      </div>
    </div>
  )
}
