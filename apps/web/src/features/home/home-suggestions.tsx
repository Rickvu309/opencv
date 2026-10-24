import { useState } from "react"
import {
  Briefcase,
  ClipboardList,
  FileText,
  Mail,
  Plus,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import {
  Suggestion as SuggestionButton,
  Suggestions,
} from "@/components/ai-elements/suggestion.tsx"

import {
  BROAD_SUGGESTIONS,
  MORE_SUGGESTIONS,
  type Suggestion,
} from "@/features/home/suggestions.ts"

const BROAD_ICONS: Record<string, LucideIcon> = {
  cv: FileText,
  letter: Mail,
  apply: Briefcase,
  proof: ClipboardList,
}

type Props = {
  onSelect: (prompt: string) => void
  className?: string
}

function Chip({
  item,
  icon: Icon,
  onSelect,
}: {
  item: Suggestion
  icon?: LucideIcon
  onSelect: (prompt: string) => void
}) {
  return (
    <SuggestionButton prompt={item.prompt} onPick={onSelect}>
      {Icon ? (
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
      {item.label}
    </SuggestionButton>
  )
}

export function HomeSuggestions({ onSelect, className }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className={cn("w-full space-y-2", className)}>
      <Suggestions>
        {BROAD_SUGGESTIONS.map((item) => (
          <Chip
            key={item.id}
            item={item}
            icon={BROAD_ICONS[item.id]}
            onSelect={onSelect}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={moreOpen}
          aria-controls="home-more-ideas"
          onClick={() => setMoreOpen((open) => !open)}
          className="h-8 shrink-0 rounded-full text-muted-foreground"
        >
          <Plus
            className={cn(
              "size-3.5 transition-transform duration-(--duration-micro)",
              moreOpen && "rotate-45"
            )}
          />
          More ideas
        </Button>
      </Suggestions>
      {moreOpen ? (
        <Suggestions id="home-more-ideas">
          {MORE_SUGGESTIONS.map((item) => (
            <Chip key={item.id} item={item} onSelect={onSelect} />
          ))}
        </Suggestions>
      ) : null}
    </div>
  )
}
