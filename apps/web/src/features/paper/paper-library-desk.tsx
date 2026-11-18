import { ArrowRight, FilePlus2, Sparkles } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import {
  entryName,
  entrySection,
  libraryDisplayName,
  type LibraryEntry,
} from "./paper-library-entries.ts"
import { LibraryDocumentSheet } from "./paper-library-sections.tsx"
import { paperEditedLabel } from "./paper-templates.ts"
import { TEMPLATE_CHOICES } from "./paper-template-pages.ts"
import { TemplatePage } from "./paper-template-thumb.tsx"
import type { PaperTemplateId } from "@workspace/domain"

export function PaperContinue({
  entry,
  onOpen,
  onCoach,
  onStart,
}: {
  entry?: Exclude<LibraryEntry, { type: "file" }>
  onOpen: () => void
  onCoach: () => void
  onStart: () => void
}) {
  return (
    <section
      aria-label={entry ? "Continue editing" : "Your Paper desk"}
      data-slot="paper-continue"
      className="paper-continue"
    >
      <div className="paper-continue-copy">
        <p className="text-xs font-medium text-muted-foreground">
          {entry ? "Continue editing" : "Your Paper desk"}
        </p>
        <h2 className="paper-continue-title">
          {entry ? libraryDisplayName(entryName(entry)) : "Start with a page"}
        </h2>
        {entry ? (
          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>{entrySection(entry) === "cv" ? "CV" : "Letter"}</span>
            {entry.type === "paper" ? (
              <span>Edited {paperEditedLabel(entry.doc.updatedAt)}</span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Create a CV or Letter, or import a document you already have.
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 md:gap-2">
          {entry ? (
            <>
              <Button
                variant="primary"
                className="min-h-11 px-2 text-sm md:px-3"
                onClick={onOpen}
              >
                Open <ArrowRight aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                className="min-h-11 px-2 text-muted-foreground hover:text-foreground md:px-3"
                onClick={onCoach}
              >
                <Sparkles aria-hidden="true" /> Ask Coach
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              className="min-h-11 text-sm"
              onClick={onStart}
            >
              <FilePlus2 aria-hidden="true" /> Create a CV
            </Button>
          )}
        </div>
      </div>
      <div className="paper-continue-stage" aria-hidden="true">
        <div className="paper-continue-stack">
          {entry ? (
            <LibraryDocumentSheet entry={entry} />
          ) : (
            <TemplatePage templateId="simple" className="paper-sheet" />
          )}
        </div>
      </div>
    </section>
  )
}

export function PaperStartStrip({
  onCV,
  onLetter,
}: {
  onCV: (template: PaperTemplateId | "blank") => void
  onLetter: () => void
}) {
  return (
    <section
      aria-labelledby="paper-start-label"
      data-slot="paper-start-strip"
      className="grid min-w-0 gap-1"
    >
      <h2 id="paper-start-label" className="text-sm font-semibold">
        Start new
      </h2>
      <div className="paper-start-strip">
        {[{ id: "blank" as const, label: "Blank CV" }, ...TEMPLATE_CHOICES].map(
          ({ id, label }) => (
            <Button
              key={id}
              variant="ghost"
              className="paper-start-tile h-11"
              onClick={() => onCV(id)}
            >
              <TemplatePage templateId={id} className="paper-sheet" />
              <span>{label}</span>
            </Button>
          )
        )}
        <Button
          variant="ghost"
          className="paper-start-tile h-11"
          onClick={onLetter}
        >
          <TemplatePage templateId="blank" className="paper-sheet" />
          <span>Blank Letter</span>
        </Button>
      </div>
    </section>
  )
}
