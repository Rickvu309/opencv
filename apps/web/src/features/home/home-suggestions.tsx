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

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={moreIdeas}
          className="h-8 shrink-0 rounded-full border-dashed text-muted-foreground"
        >
          <RefreshCw className={cn("size-3.5", spinning && "animate-spin")} />
          More ideas
        </Button>
        {ideas.map((item) => {
          const Icon = ICONS[item.id] ?? Sparkles
          return (
            <Button
              key={`${poolIndex}-${item.id}`}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelect(item.prompt)}
              className="h-8 shrink-0 rounded-full"
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              {item.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
