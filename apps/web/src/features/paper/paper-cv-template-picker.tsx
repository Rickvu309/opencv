import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { Check, ChevronDown, LayoutTemplate } from "lucide-react"
import { useState } from "react"

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
  const [open, setOpen] = useState(false)
  const active = CV_TEMPLATES.find((t) => t.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground"
          />
        }
        onMouseDown={(e) => e.preventDefault()}
        aria-haspopup="listbox"
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
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[22rem] p-2"
        data-cv-template-panel
      >
        <div role="listbox" aria-label="CV templates">
          <p className="px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Template
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {CV_TEMPLATES.map((template) => {
              const selected = template.id === value
              return (
                <Button
                  key={template.id}
                  type="button"
                  variant="ghost"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(template.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "relative h-auto flex-col items-start rounded-lg border p-2.5 text-left",
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
                  <p className="mt-1.5 text-xs leading-tight font-semibold">
                    {template.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    {template.useCase}
                  </p>
                </Button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TemplateThumb({ id }: { id: CvTemplateId }) {
  if (id === "product") {
    return (
      <div className="flex h-12 overflow-hidden rounded border border-border/80 bg-background">
        <div className="w-[30%] bg-foreground p-1">
          <div className="mb-0.5 h-0.5 w-3/4 rounded bg-background/80" />
          <div className="h-0.5 w-full rounded bg-background/30" />
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
      <div className="h-12 rounded border border-border/80 bg-background p-1">
        <div className="mb-1 h-1 w-2/3 rounded bg-foreground/80" />
        <div className="mb-0.5 h-0.5 w-full rounded bg-muted" />
        <div className="h-0.5 w-1/2 rounded bg-muted/60" />
      </div>
    )
  }

  if (id === "academic") {
    return (
      <div className="h-12 rounded border border-border/80 bg-background p-1">
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
      <div className="flex h-12 gap-1 overflow-hidden rounded border border-border/80 bg-background p-1">
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
    <div className="h-12 rounded border border-border/80 bg-background p-1 text-center">
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
