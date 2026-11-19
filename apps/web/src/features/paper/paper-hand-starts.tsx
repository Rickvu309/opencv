import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { PaperLetterArt } from "./paper-letter-art.tsx"
import { TemplatePage } from "./paper-template-thumb.tsx"

export function PaperStarts({
  dropping,
  onNewCV,
  onNewLetter,
  onOpenImport,
}: {
  dropping: boolean
  onNewCV: () => void
  onNewLetter: () => void
  onOpenImport: () => void
}) {
  return (
    <div className="paper-hand-starts">
      <Button
        type="button"
        variant="ghost"
        className="paper-hand-start h-11 hover:bg-transparent"
        onClick={onNewCV}
      >
        <span className="paper-hand-start-label">New CV</span>
        <span className="paper-hand-mini" aria-hidden="true">
          <TemplatePage templateId="modern" className="" />
          <TemplatePage templateId="compact" className="" />
          <TemplatePage templateId="simple" className="" />
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="paper-hand-start h-11 hover:bg-transparent"
        onClick={onNewLetter}
      >
        <span className="paper-hand-start-label">New Letter</span>
        <span className="paper-hand-mini" aria-hidden="true">
          <PaperLetterArt />
          <PaperLetterArt />
          <PaperLetterArt />
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "paper-hand-start h-11 hover:bg-transparent",
          dropping && "is-target"
        )}
        onClick={onOpenImport}
      >
        <span className="paper-hand-start-label">Import</span>
        <span className="paper-hand-import" aria-hidden="true">
          <span className="paper-picture paper-hand-import-file" />
          <span className="paper-hand-import-tray" />
        </span>
      </Button>
    </div>
  )
}
