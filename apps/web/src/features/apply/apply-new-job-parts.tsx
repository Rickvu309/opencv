import type { ReactNode } from "react"
import { ArrowUpRight, CircleAlert, Rocket } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { stageLabel } from "./apply-stages.ts"
import type { JobStage } from "@workspace/domain"

export const PLACEHOLDER_CARD = "placeholder:text-muted-foreground/84"
export const PLACEHOLDER_SECONDARY = "placeholder:text-muted-foreground/88"

export function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-1.5 pt-1 pb-0.5 text-[12.5px] leading-[15px] text-foreground"
    >
      <CircleAlert className="size-[13px] shrink-0" aria-hidden />
      {children}
    </p>
  )
}

export function AlreadyTracked({
  title,
  company,
  stage,
  onOpen,
}: {
  title: string
  company: string
  stage: JobStage
  onOpen: () => void
}) {
  return (
    <div
      data-slot="already-tracked"
      className="flex items-center gap-2.5 rounded-lg bg-secondary py-2.5 pr-2.5 pl-3"
    >
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-card text-foreground ring-1 ring-foreground/8">
        <Rocket className="size-3.5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <p className="text-[13px] font-medium text-foreground">
          Already on your board
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {title} at {company}, in {stageLabel(stage)}
        </p>
      </div>
      <Button
        type="button"
        className="h-11 gap-1.5 rounded-md px-2.5 text-xs md:h-7"
        onClick={onOpen}
      >
        Open
        <ArrowUpRight className="size-3 text-muted-foreground" aria-hidden />
      </Button>
    </div>
  )
}
