import { Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { useFirstCafeChecklist } from "@/features/home/use-first-cafe-checklist.ts"

export function FirstCafeNudge({
  aimResolved = false,
}: {
  aimResolved?: boolean
}) {
  const { nudge, skipNudge } = useFirstCafeChecklist({ aimResolved })

  if (!nudge) return null

  const quietDone = nudge.optional === true

  return (
    <section
      role="region"
      aria-labelledby="first-cafe-nudge-heading"
      className="w-full max-w-md rounded-xl border border-border/70 bg-background px-4 py-3 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="first-cafe-nudge-heading"
            className="font-heading text-sm font-medium tracking-tight"
          >
            {quietDone ? "You're set" : "One next thing"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Skip whenever. This is not a tour.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          onClick={skipNudge}
        >
          {quietDone ? "Hide" : "Skip"}
        </Button>
      </div>

      <Link
        to={nudge.to}
        search={nudge.search}
        className={cn(
          FOCUS_RING,
          "mt-2.5 flex items-center rounded-md px-0.5 py-1.5 text-sm transition-colors hover:bg-muted/40"
        )}
      >
        {nudge.label}
        {quietDone ? (
          <span className="ml-1.5 text-xs text-muted-foreground">
            optional
          </span>
        ) : null}
      </Link>
    </section>
  )
}
