import type { ComponentProps, ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type ConfirmationProps = Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode
  detail?: ReactNode
  onApprove: () => void
  onDeny: () => void
  approveLabel?: string
  denyLabel?: string
  pending?: boolean
}

export function Confirmation({
  title,
  detail,
  onApprove,
  onDeny,
  approveLabel = "Approve",
  denyLabel = "Deny",
  pending = false,
  className,
  ...props
}: ConfirmationProps) {
  return (
    <div
      role="group"
      aria-label="Confirm Coach step"
      data-slot="confirmation"
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm",
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {detail ? <p className="text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onDeny}
        >
          {denyLabel}
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={onApprove}>
          {approveLabel}
        </Button>
      </div>
    </div>
  )
}
