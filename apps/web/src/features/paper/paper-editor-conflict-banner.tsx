import { Button } from "@workspace/ui/components/button"

import { TYPE_LABEL, type PaperDoc } from "./paper-data.ts"

type Props = {
  kind: PaperDoc["kind"]
  onKeepMine: () => void
  onUseServer: () => void
}

export function PaperEditorConflictBanner({
  kind,
  onKeepMine,
  onUseServer,
}: Props) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/60 px-5 py-2 text-sm"
    >
      <p>Coach updated this {TYPE_LABEL[kind]} while you have unsaved edits.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onKeepMine}>
          Keep mine
        </Button>
        <Button type="button" size="sm" onClick={onUseServer}>
          Use Coach&apos;s version
        </Button>
      </div>
    </div>
  )
}
