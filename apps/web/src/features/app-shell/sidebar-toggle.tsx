import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

type Props = {
  label: string
  direction: "close" | "open"
  onClick: () => void
  className?: string
}

export function SidebarToggle({ label, direction, onClick, className }: Props) {
  const Icon = direction === "close" ? PanelLeftClose : PanelLeftOpen

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-slot="sidebar-toggle"
            aria-label={label}
            aria-keyshortcuts="["
            className={cn("hover:bg-sidebar-accent md:size-7", className)}
            onClick={onClick}
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
