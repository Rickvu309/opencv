import { Button } from "@workspace/ui/components/button"

import {
  APPLY_DEMO_CLEAR_LABEL,
  APPLY_DEMO_TEXT,
  APPLY_DEMO_TITLE,
} from "@/features/apply/apply-job-structure.ts"

export function ApplyDemoBanner({
  onClear,
  clearing,
}: {
  onClear: () => void
  clearing: boolean
}) {
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-muted/40 px-4 py-2.5 sm:px-5"
    >
      <p className="min-w-0 flex-1 text-sm text-foreground">
        <span className="font-medium">{APPLY_DEMO_TITLE}.</span>{" "}
        {APPLY_DEMO_TEXT}
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 shrink-0"
        disabled={clearing}
        onClick={onClear}
      >
        {APPLY_DEMO_CLEAR_LABEL}
      </Button>
    </div>
  )
}
