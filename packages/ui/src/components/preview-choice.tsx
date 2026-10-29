import type { ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type PreviewChoiceProps = {
  label: string
  children: ReactNode
  outlined?: boolean
  className?: string
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void })

export function PreviewChoice({
  label,
  children,
  outlined,
  className,
  ...action
}: PreviewChoiceProps) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "block w-full overflow-clip rounded-sm bg-card text-card-foreground shadow-lg ring-1 ring-border/20",
          outlined && "ring-foreground"
        )}
      >
        {children}
      </span>
      <span
        className={cn("text-sm font-medium", !outlined && "text-foreground/85")}
      >
        {label}
      </span>
    </>
  )
  const classes = cn(
    "group flex h-auto flex-col items-center gap-3.5 rounded-sm border-0 p-0 hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-ring active:opacity-80",
    className
  )
  return action.href !== undefined ? (
    <a
      data-slot="preview-choice"
      href={action.href}
      aria-label={label}
      className={classes}
    >
      {content}
    </a>
  ) : (
    <Button
      data-slot="preview-choice"
      type="button"
      variant="ghost"
      aria-label={label}
      className={classes}
      onClick={action.onClick}
    >
      {content}
    </Button>
  )
}
