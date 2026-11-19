import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { PaperLetterArt } from "./paper-letter-art.tsx"
import { TemplatePage } from "./paper-template-thumb.tsx"

import "./design/paper-start-hand.css"

export function PaperStartHand({
  dropping,
  importName,
  onNewCV,
  onNewLetter,
  onOpenImport,
}: {
  dropping: boolean
  importName: string | null
  onNewCV: () => void
  onNewLetter: () => void
  onOpenImport: () => void
}) {
  return (
    <div className="paper-start">
      <div
        role="group"
        aria-label="Start a document"
        className="paper-start-hand"
      >
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "paper-start-card h-11 hover:bg-transparent",
            dropping && "is-target"
          )}
          data-start="import"
          onClick={onOpenImport}
        >
          <span
            className="paper-start-page paper-start-word"
            aria-hidden="true"
          >
            <span className="paper-picture paper-start-word-file">
              <span className="paper-hand-import-badge">DOCX</span>
            </span>
            <span className="paper-hand-import-tray" />
          </span>
          <span className="paper-start-label">Import</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="paper-start-card h-11 hover:bg-transparent"
          data-start="cv"
          onClick={onNewCV}
        >
          <span className="paper-start-page" aria-hidden="true">
            <TemplatePage templateId="modern" className="paper-start-art" />
            <span className="paper-start-plus">
              <Plus />
            </span>
          </span>
          <span className="paper-start-label">New CV</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="paper-start-card h-11 hover:bg-transparent"
          data-start="letter"
          onClick={onNewLetter}
        >
          <span className="paper-start-page" aria-hidden="true">
            <PaperLetterArt className="paper-start-art" />
            <span className="paper-start-plus">
              <Plus />
            </span>
          </span>
          <span className="paper-start-label">New Letter</span>
        </Button>
      </div>
      <div className="paper-hand-caption" aria-live="polite">
        <span className="paper-hand-caption-name">
          {importName ?? "Start your first document"}
        </span>
        <span className="paper-hand-caption-meta">
          {importName ? (
            "Adding"
          ) : (
            <>
              <span className="max-md:hidden">
                Pick a card, or drop a Word file anywhere on this page.
              </span>
              <span className="md:hidden">Pick a card to begin.</span>
            </>
          )}
        </span>
      </div>
    </div>
  )
}
