import { Button } from "@workspace/ui/components/button"

import { BrandIcon } from "@/features/app-shell/brand-icon.tsx"
import { brandLabel, type BrandId } from "@/features/app-shell/brands.ts"

const CATALOG: { id: BrandId; description: string }[] = [
  {
    id: "gmail",
    description:
      "Pull recruiter replies and application confirmations into Apply. Match mail to Opportunities automatically.",
  },
  {
    id: "outlook",
    description:
      "Sync school and internship email. Surface deadlines and interview invites on your calendar.",
  },
  {
    id: "google-calendar",
    description:
      "Show interviews and follow-ups on the Apply calendar. Get reminders before each step.",
  },
]

export function AppsCatalog() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {CATALOG.map((app) => (
        <article
          key={app.id}
          className="flex flex-col rounded-lg border border-border bg-background p-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 p-1.5">
              <BrandIcon brand={app.id} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{brandLabel(app.id)}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {app.description}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button type="button" size="sm" disabled>
              Connect
              <span className="text-muted-foreground"> · Coming soon</span>
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}
