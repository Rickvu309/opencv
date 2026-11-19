import { Link } from "@tanstack/react-router"
import { ChevronDown, ChevronUp, Maximize2, X } from "lucide-react"
import type { JobId } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

export function ApplyPeekHeader({
  position,
  jobId,
  onPrevious,
  onNext,
  onClose,
}: {
  position: string | null
  jobId: JobId | null
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  onClose: () => void
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-foreground/6 pr-2 pl-4">
      <span className="mr-auto text-xs text-muted-foreground tabular-nums">
        {position}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="max-md:size-11"
        aria-label="Previous job"
        title="Previous job (K)"
        disabled={!onPrevious}
        onClick={onPrevious ?? undefined}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="max-md:size-11"
        aria-label="Next job"
        title="Next job (J)"
        disabled={!onNext}
        onClick={onNext ?? undefined}
      >
        <ChevronDown />
      </Button>
      {jobId ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-md:size-11"
          aria-label="Open full page"
          title="Open full page"
          nativeButton={false}
          render={<Link to="/apply/$jobId" params={{ jobId }} />}
        >
          <Maximize2 />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="max-md:size-11"
        aria-label="Close"
        title="Close (Esc)"
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  )
}
