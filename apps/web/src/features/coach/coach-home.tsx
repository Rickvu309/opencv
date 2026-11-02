import "./design/home.pen.css"

import type { ReactNode } from "react"
import {
  Briefcase,
  Building2,
  Calendar,
  CircleUser,
  FileText,
  Handshake,
  Mail,
  MessagesSquare,
  RefreshCw,
  Scale,
  Send,
  Target,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"

const STARTERS = [
  { label: "Review my CV", icon: FileText },
  { label: "Find roles", icon: Briefcase },
  { label: "Prep an interview", icon: MessagesSquare },
  { label: "Write a cover letter", icon: Mail },
  { label: "Plan my week", icon: Calendar },
  { label: "Negotiate an offer", icon: Handshake },
]

const MORE_STARTERS = [
  { label: "Follow up on an application", icon: Send },
  { label: "Compare two offers", icon: Scale },
  { label: "Improve my LinkedIn", icon: CircleUser },
  { label: "Companies hiring now", icon: Building2 },
  { label: "Set a weekly goal", icon: Target },
]

export function CoachHome({
  children,
  moreIdeas,
  onToggleIdeas,
  onChooseStarter,
  disabled,
}: {
  children: ReactNode
  moreIdeas: boolean
  onToggleIdeas: () => void
  onChooseStarter: (text: string) => void
  disabled: boolean
}) {
  return (
    <div
      data-slot="coach-home"
      data-pen-surface="coach"
      className="pbs-22 sm:pbs-57 grid min-h-full grid-cols-[minmax(1rem,1fr)_minmax(0,42.5rem)_minmax(1rem,1fr)] content-start gap-y-3.5"
    >
      <h2 className="pbe-2.5 col-start-2 text-center text-[26px] leading-[31px] font-semibold tracking-[-0.8px]">
        How can I help?
      </h2>
      <div className="col-start-2">{children}</div>
      <div data-slot="coach-ideas" className="relative col-start-2 min-w-0">
        <div
          role="group"
          aria-label="Ideas for Coach"
          className="flex gap-2 overflow-x-auto py-1"
          onFocus={(event) =>
            event.target.scrollIntoView?.({
              block: "nearest",
              inline: "nearest",
            })
          }
        >
          <Button
            variant="ghost"
            className="h-10 shrink-0 gap-2 rounded-full ps-3.5 pe-4 text-muted-foreground"
            aria-pressed={moreIdeas}
            onClick={onToggleIdeas}
          >
            <RefreshCw className="size-4" />
            More ideas
          </Button>
          {(moreIdeas ? MORE_STARTERS : STARTERS).map(
            ({ label, icon: Icon }) => (
              <Button
                key={label}
                variant="outline"
                className="h-10 shrink-0 gap-2 rounded-full bg-card ps-3.5 pe-4 text-foreground"
                disabled={disabled}
                onClick={() => onChooseStarter(label)}
              >
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </Button>
            )
          )}
        </div>
        <div aria-hidden="true" data-slot="coach-ideas-fade" />
      </div>
    </div>
  )
}
