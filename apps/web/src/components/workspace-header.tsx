import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

type WorkspaceHeaderProps = {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * Shared workspace chrome. Compact toolbar (Apply / Pitch / Paper editor)
 * or a page header with description (Settings).
 */
export function WorkspaceHeader({
  title,
  description,
  icon,
  children,
  className,
}: WorkspaceHeaderProps) {
  const page = Boolean(description)

  return (
    <header
      className={cn(
        "flex shrink-0 border-b border-border bg-background",
        page
          ? "flex-col px-4 py-4 sm:px-6"
          : "flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5",
        className
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          page ? "w-full" : "min-w-0 flex-1"
        )}
      >
        {icon}
        {typeof title === "string" ? (
          <h1
            className={
              page
                ? "text-section-title font-semibold tracking-tight"
                : "text-sm font-semibold tracking-tight"
            }
          >
            {title}
          </h1>
        ) : (
          title
        )}
      </div>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </header>
  )
}
