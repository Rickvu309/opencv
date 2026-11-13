import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { ChevronDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  className,
  ...props
}: Omit<CollapsiblePrimitive.Trigger.Props, "className"> & {
  className?: string
}) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn("group/collapsible-trigger", className)}
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={
        typeof className === "function"
          ? (state) => cn("motion-collapse", className(state))
          : cn("motion-collapse", className)
      }
      {...props}
    />
  )
}

function CollapsibleIndicator({ className }: { className?: string }) {
  return (
    <ChevronDown
      aria-hidden="true"
      data-slot="collapsible-indicator"
      className={cn(
        "-rotate-90 transition-transform duration-(--duration-micro) ease-(--ease-micro) group-data-[panel-open]/collapsible-trigger:rotate-0 motion-reduce:transition-none",
        className
      )}
    />
  )
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleIndicator,
}
