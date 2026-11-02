import { useReducer } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { HANDOFF_ATTRIBUTE } from "@/features/app-shell/sidebar-focus.ts"

type Props = {
  label: string
  direction: "close" | "open"
  onClick: () => void
  suppressed?: boolean
  className?: string
}

export function SidebarToggle({
  label,
  direction,
  onClick,
  suppressed = false,
  className,
}: Props) {
  const Icon = direction === "close" ? PanelLeftClose : PanelLeftOpen
  const [open, setOpen] = useReducer(
    (_open: boolean, next: boolean) => next,
    false
  )
  if (suppressed && open) setOpen(false)

  return (
    <Tooltip
      disableHoverablePopup
      open={open && !suppressed}
      onOpenChange={(next, details) => {
        const handedOff =
          details.reason === "trigger-focus" &&
          details.trigger?.hasAttribute(HANDOFF_ATTRIBUTE)
        if (next && (suppressed || handedOff)) return
        setOpen(next)
      }}
    >
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-slot="sidebar-toggle"
            data-direction={direction}
            aria-label={label}
            aria-keyshortcuts="["
            className={cn(
              "size-11 hover:bg-sidebar-accent md:size-7",
              className
            )}
            onClick={onClick}
            onBlur={(event) =>
              event.currentTarget.removeAttribute(HANDOFF_ATTRIBUTE)
            }
          />
        }
      >
        <Icon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        <Kbd>[</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
