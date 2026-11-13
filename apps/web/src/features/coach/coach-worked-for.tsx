import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { Lightbulb } from "lucide-react"

import type { CoachReadTrace } from "./coach-read-trace.ts"

function workedForText(workedMs: number) {
  return `Worked for ${Math.max(1, Math.round(workedMs / 1000))}s`
}

export function CoachWorkedFor({
  workedMs,
  traces,
}: {
  workedMs: number
  traces: readonly CoachReadTrace[]
}) {
  if (traces.length === 0)
    return (
      <p
        data-slot="coach-worked-for"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"
      >
        <Lightbulb aria-hidden="true" className="size-3.5 shrink-0" />
        {workedForText(workedMs)}
      </p>
    )
  return (
    <Collapsible data-slot="coach-worked-for">
      <CollapsibleTrigger className="-mx-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-[13px] text-muted-foreground transition-colors duration-(--duration-micro) ease-(--ease-micro) outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-7">
        <Lightbulb aria-hidden="true" className="size-3.5 shrink-0" />
        {workedForText(workedMs)}
        <CollapsibleIndicator className="size-3.5" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul
          data-slot="coach-read-traces"
          className="ms-1 mt-1 space-y-1 border-s border-border ps-3 text-[13px] text-muted-foreground"
        >
          {traces.map((trace) => (
            <li key={trace.key}>{trace.label}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
