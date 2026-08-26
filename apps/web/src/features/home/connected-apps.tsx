import { Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { BrandIcon } from "@/features/app-shell/brand-icon.tsx"
import { type BrandId } from "@/features/app-shell/brands.ts"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"

const APPS: { id: BrandId; name: string }[] = [
  { id: "gmail", name: "Gmail" },
  { id: "outlook", name: "Outlook" },
  { id: "google-calendar", name: "Google Calendar" },
]

type Props = {
  className?: string
}

export function ConnectedApps({ className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2.5 text-sm text-muted-foreground",
        className
      )}
    >
      <Link
        to={SURFACE_PATHS.settings}
        search={{ tab: "apps" }}
        className={cn(
          FOCUS_RING,
          "inline-flex items-center gap-0.5 rounded-sm transition-colors hover:text-foreground"
        )}
      >
        Connect apps
        <ChevronRight className="size-3.5" aria-hidden />
      </Link>
      <div className="flex items-center gap-1.5" aria-hidden>
        {APPS.map(({ id, name }) => (
          <span
            key={id}
            title={name}
            className="flex size-6 items-center justify-center rounded-md border border-border bg-background p-0.5"
          >
            <BrandIcon brand={id} className="size-4" />
          </span>
        ))}
      </div>
    </div>
  )
}
