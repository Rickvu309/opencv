import "./design/home.pen.css"

import { useId, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"

import { COACH_STARTERS } from "./coach-starters.ts"

export function CoachHome({
  children,
  onChooseStarter,
  disabled,
}: {
  children: ReactNode
  onChooseStarter: (text: string) => void
  disabled: boolean
}) {
  const describedBy = useId()
  return (
    <div
      data-slot="coach-home"
      data-pen-surface="coach"
      className="pbs-22 sm:pbs-57 grid min-h-full grid-cols-[minmax(1rem,1fr)_minmax(0,42.5rem)_minmax(1rem,1fr)] content-start gap-y-3.5 pb-16"
    >
      <h2 className="pbe-2 col-start-2 text-center text-[20px] leading-[26px] font-medium tracking-[-0.3px]">
        How can I help?
      </h2>
      <div className="col-start-2">{children}</div>
      <ul
        data-slot="coach-ideas"
        aria-label="Ideas for Coach"
        className="col-start-2 grid min-w-0 grid-cols-1 gap-2 pt-1 sm:grid-cols-3"
      >
        {COACH_STARTERS.map(({ title, description, icon: Icon }, index) => (
          <li key={title} className="min-w-0">
            <Button
              variant="outline"
              data-slot="coach-starter"
              className="h-auto min-h-14 w-full flex-row items-center justify-start gap-3 rounded-[10px] bg-card px-3.5 py-2.5 text-left whitespace-normal sm:min-h-[124px] sm:flex-col sm:items-start sm:justify-between sm:gap-6 sm:p-4"
              aria-label={title}
              aria-describedby={`${describedBy}-${index}`}
              disabled={disabled}
              onClick={() => onChooseStarter(title)}
            >
              <Icon
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[13px] leading-4 font-medium text-foreground">
                  {title}
                </span>
                <span
                  id={`${describedBy}-${index}`}
                  className="text-xs leading-4 font-normal text-muted-foreground"
                >
                  {description}
                </span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
