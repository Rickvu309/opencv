import type { ComponentProps, HTMLAttributes } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

export type StatusProps = ComponentProps<typeof Badge>

export const Status = ({ className, ...props }: StatusProps) => (
  <Badge
    data-slot="status"
    className={cn("flex items-center gap-2", className)}
    variant="secondary"
    {...props}
  />
)

export type StatusIndicatorProps = HTMLAttributes<HTMLSpanElement>

export const StatusIndicator = ({
  className,
  ...props
}: StatusIndicatorProps) => (
  <span
    data-slot="status-indicator"
    className={cn(
      "size-2 shrink-0 rounded-full bg-muted-foreground",
      className
    )}
    {...props}
  />
)

export type StatusLabelProps = HTMLAttributes<HTMLSpanElement>

export const StatusLabel = ({ className, ...props }: StatusLabelProps) => (
  <span
    data-slot="status-label"
    className={cn("text-foreground", className)}
    {...props}
  />
)
