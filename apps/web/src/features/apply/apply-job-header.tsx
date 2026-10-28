import { Link } from "@tanstack/react-router"
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Ellipsis,
  Star,
} from "lucide-react"

import type { JobDetail } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { TITLE_TEXT } from "./apply-detail-parts.tsx"

const ICON_BUTTON =
  "shrink-0 rounded-[6px] p-0 text-muted-foreground hover:bg-secondary aria-expanded:bg-secondary"

export function JobHeader({
  job,
  position,
  total,
  onPrevious,
  onNext,
  onToggleStar,
  onDelete,
}: {
  job: JobDetail
  position: number
  total: number
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  onToggleStar: () => void
  onDelete: () => void
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-[52px] shrink-0 items-center gap-2 border-b border-foreground/6 pr-4 pl-5"
    >
      <Link to="/apply" className="text-[13px] text-muted-foreground">
        Apply
      </Link>
      <ChevronRight aria-hidden className="size-[13px] text-muted-foreground" />
      <span className="flex min-w-0 items-center gap-1.5">
        <Briefcase aria-hidden className="size-3.5 shrink-0 text-foreground" />
        <span className={cn("truncate text-[13px] font-medium", TITLE_TEXT)}>
          {job.title}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        aria-label="Favorite"
        aria-pressed={job.starred}
        className={cn("size-[26px]", ICON_BUTTON)}
        onClick={onToggleStar}
      >
        <Star
          aria-hidden
          className={cn(
            "size-[26px] p-[5.5px]",
            job.starred && "fill-current text-foreground"
          )}
        />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label="More"
              className={cn("size-[26px]", ICON_BUTTON)}
            />
          }
        >
          <Ellipsis aria-hidden className="size-[26px] p-[5.5px]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onDelete}>Delete job</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="flex-1" />
      <span className="mr-1.5 text-[12.5px] whitespace-nowrap text-muted-foreground">
        {position > 0 ? `${position} / ${total}` : ""}
      </span>
      <Button
        type="button"
        variant="ghost"
        aria-label="Previous job"
        disabled={!onPrevious}
        className={cn("size-7", ICON_BUTTON)}
        onClick={() => onPrevious?.()}
      >
        <ChevronUp aria-hidden className="size-7 p-[6.5px]" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-label="Next job"
        disabled={!onNext}
        className={cn("size-7", ICON_BUTTON)}
        onClick={() => onNext?.()}
      >
        <ChevronDown aria-hidden className="size-7 p-[6.5px]" />
      </Button>
    </nav>
  )
}
