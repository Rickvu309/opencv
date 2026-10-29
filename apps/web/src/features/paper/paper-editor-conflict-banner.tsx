import { Button } from "@workspace/ui/components/button"

type Props = {
  onReload: () => void
}

export function PaperEditorConflictBanner({ onReload }: Props) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/60 px-5 py-2 text-sm"
    >
      <p>This document changed. Reload it and try again.</p>
      <Button type="button" size="sm" variant="outline" onClick={onReload}>
        Reload
      </Button>
    </div>
  )
}
