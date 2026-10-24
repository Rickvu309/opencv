import type { ComponentProps, ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  /** The prompt this suggestion sends. */
  prompt: string
  onPick: (prompt: string) => void
  children?: ReactNode
}

export function Suggestion({
  prompt,
  onPick,
  children,
  className,
  ...props
}: SuggestionProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-slot="suggestion"
      className={cn("h-8 shrink-0 rounded-full", className)}
      onClick={() => onPick(prompt)}
      {...props}
    >
      {children ?? prompt}
    </Button>
  )
}

export function Suggestions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="suggestions"
      className={cn("flex flex-wrap justify-center gap-2", className)}
      {...props}
    />
  )
}
