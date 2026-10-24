import { Link } from "@tanstack/react-router"
import { Check } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import type { useFirstCafeChecklist } from "@/features/home/use-first-cafe-checklist.ts"

export function FirstCafeChecklist({
  cafe: { visible, completed, items, dismiss },
}: {
  cafe: ReturnType<typeof useFirstCafeChecklist>
}) {
  if (!visible) return null

  const done = new Set(completed)

  return (
    <section
      role="region"
      aria-labelledby="first-cafe-heading"
      className="w-full max-w-md rounded-xl border border-border/70 bg-background px-4 py-3 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="first-cafe-heading"
            className="font-heading text-sm font-medium tracking-tight"
          >
            Four small things
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
          onClick={dismiss}
        >
          Hide this
        </Button>
      </div>

      <ul className="mt-2.5 space-y-0.5">
        {items.map((item) => {
          const isDone = done.has(item.id)
          const name = isDone
            ? `${item.label}, done`
            : item.optional
              ? `${item.label}, optional`
              : item.label

          return (
            <li key={item.id}>
              <Link
                to={item.to}
                search={item.search}
                aria-label={name}
                className={cn(
                  FOCUS_RING,
                  "flex items-center gap-2.5 rounded-md px-0.5 py-1.5 text-sm transition-colors hover:bg-muted/40",
                  isDone && "text-muted-foreground"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    isDone
                      ? "border-foreground/25 bg-muted"
                      : "border-border bg-background"
                  )}
                >
                  {isDone ? <Check className="size-3" /> : null}
                </span>
                <span
                  className={cn(
                    isDone && "line-through decoration-muted-foreground/50"
                  )}
                >
                  {item.label}
                  {item.optional && !isDone ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      optional
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
