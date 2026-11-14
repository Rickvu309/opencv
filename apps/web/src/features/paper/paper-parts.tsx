import { FileText, Upload, type LucideIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

export function NewPaperCard({
  title,
  body,
  icon: Icon = FileText,
  onClick,
}: {
  title: string
  body: string
  icon?: LucideIcon
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={title}
      className="h-36 min-w-0 flex-col items-start justify-between rounded-lg bg-card p-4 text-left whitespace-normal"
      onClick={onClick}
    >
      <Icon className="text-muted-foreground" aria-hidden="true" />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {body}
        </span>
      </span>
    </Button>
  )
}

export function PaperLibraryStarters({
  onCv,
  onLetter,
  onImport,
}: {
  onCv: () => void
  onLetter: () => void
  onImport: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-medium">Start a document</h2>
        <p className="text-sm text-muted-foreground">
          Pick a page, or bring a file you already have.
        </p>
      </div>
      <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        <NewPaperCard title="CV" body="A page you can send." onClick={onCv} />
        <NewPaperCard
          title="Cover letter"
          body="A letter for one job."
          onClick={onLetter}
        />
        <NewPaperCard
          title="Import"
          body="Bring an existing file."
          icon={Upload}
          onClick={onImport}
        />
      </div>
    </div>
  )
}
