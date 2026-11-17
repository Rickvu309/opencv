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
  children,
  ...props
}: Omit<CollapsiblePrimitive.Panel.Props, "className"> & {
  className?: string
}) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className="motion-collapse"
      {...props}
    >
      <div data-slot="collapsible-body" className={className}>
        {children}
      </div>
    </CollapsiblePrimitive.Panel>
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
