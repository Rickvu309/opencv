import "./design/home.pen.css"

import { useId, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { COACH_STARTERS } from "./coach-starters.ts"

export type CoachHomeSize = "page" | "panel"

export function CoachHome({
  children,
  onChooseStarter,
  disabled,
  size = "page",
}: {
  children?: ReactNode
  onChooseStarter: (text: string) => void
  disabled: boolean
  size?: CoachHomeSize
}) {
  const describedBy = useId()
  const panel = size === "panel"
  return (
    <div
      data-slot="coach-home"
      data-pen-surface="coach"
      data-size={size}
      className={cn(
        "flex w-full min-w-0 flex-col items-center",
        panel
          ? "my-auto py-6 [@media(max-height:20rem)]:hidden"
          : "min-h-full justify-start px-4 pt-[14dvh] pb-16 md:justify-center md:pt-12 md:pb-[16dvh]"
      )}
    >
      <h2
        className={cn(
          "text-center font-medium text-balance text-foreground",
          panel
            ? "mb-4 text-[20px] leading-[26px] tracking-[-0.01em]"
            : "mb-6 text-[24px] leading-[30px] tracking-[-0.02em] md:text-[28px] md:leading-9"
        )}
      >
        How can I help?
      </h2>
      {children ? (
        <div data-slot="coach-home-composer" className="w-full max-w-[720px]">
          {children}
        </div>
      ) : null}
      <ul
        data-slot="coach-ideas"
        aria-label="Ideas for Coach"
        className={cn(
          "flex w-full max-w-[720px] min-w-0 flex-wrap justify-center gap-2",
          children ? "mt-4" : null
        )}
      >
        {COACH_STARTERS.map(({ title, description, icon: Icon }, index) => (
          <li key={title} className="min-w-0">
            <Button
              variant="outline"
              data-slot="coach-starter"
              aria-label={title}
              className="h-11 max-w-full min-w-0 gap-2 rounded-full border-border bg-transparent px-3.5 text-[14px] leading-5 font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground md:h-9"
              aria-describedby={`${describedBy}-${index}`}
              disabled={disabled}
              onClick={() => onChooseStarter(title)}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{title}</span>
              <span id={`${describedBy}-${index}`} className="sr-only">
                {description}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
