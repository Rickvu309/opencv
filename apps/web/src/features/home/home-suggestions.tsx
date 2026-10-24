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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onSelect(item.prompt)}
      className="h-8 shrink-0 rounded-full"
    >
      {Icon ? (
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
      {item.label}
    </Button>
  )
}

export function HomeSuggestions({ onSelect, className }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex flex-wrap justify-center gap-2">
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
              "duration-(--duration-micro) size-3.5 transition-transform",
              moreOpen && "rotate-45"
            )}
          />
          More ideas
        </Button>
      </div>
      {moreOpen ? (
        <div
          id="home-more-ideas"
          className="flex flex-wrap justify-center gap-2"
        >
          {MORE_SUGGESTIONS.map((item) => (
            <Chip key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
