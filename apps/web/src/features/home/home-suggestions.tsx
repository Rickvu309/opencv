import { useMemo, useState } from "react"
import {
  Briefcase,
  ClipboardList,
  FileText,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { FOCUS_RING } from "@/features/app-shell/focus-ring.ts"
import { SUGGESTION_POOLS } from "@/features/home/suggestions.ts"

const ICONS: Record<string, LucideIcon> = {
  interview: Sparkles,
  letter: Mail,
  cv: FileText,
  apply: Briefcase,
  proof: ClipboardList,
  followup: Mail,
  pitch: Sparkles,
  inbox: Target,
  star: Briefcase,
  gap: Search,
  linkedin: MessageCircle,
  outcome: FileText,
  "letter-fintech": Mail,
  deadline: ClipboardList,
  reject: Sparkles,
  project: FileText,
  mock: MessageCircle,
  salary: Search,
  referral: Mail,
  portfolio: FileText,
  compare: Briefcase,
  weekend: Target,
  anxiety: Sparkles,
  "proof-link": ClipboardList,
}

type Props = {
  onSelect: (prompt: string) => void
  className?: string
}

export function HomeSuggestions({ onSelect, className }: Props) {
  const [poolIndex, setPoolIndex] = useState(0)
  const [spinning, setSpinning] = useState(false)

  const ideas = useMemo(
    () => SUGGESTION_POOLS[poolIndex % SUGGESTION_POOLS.length] ?? [],
    [poolIndex]
  )

  function moreIdeas() {
    setSpinning(true)
    setPoolIndex((i) => i + 1)
    window.setTimeout(() => setSpinning(false), 400)
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background via-background/80 to-transparent"
        aria-hidden
      />
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={moreIdeas}
          className={cn(
            FOCUS_RING,
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <RefreshCw className={cn("size-3.5", spinning && "animate-spin")} />
          More ideas
        </button>
        {ideas.map((item) => {
          const Icon = ICONS[item.id] ?? Sparkles
          return (
            <button
              key={`${poolIndex}-${item.id}`}
              type="button"
              onClick={() => onSelect(item.prompt)}
              className={cn(
                FOCUS_RING,
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium whitespace-nowrap transition-colors hover:bg-muted/50"
              )}
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
