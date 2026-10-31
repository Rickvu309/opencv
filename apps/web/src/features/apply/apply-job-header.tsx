import { Link } from "@tanstack/react-router"
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Ellipsis,
  Link as LinkIcon,
  PanelRight,
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
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { FAINT_TEXT } from "./apply-tone.ts"
import { TITLE_TEXT } from "./apply-detail-parts.tsx"

const ICON_BUTTON =
  "shrink-0 rounded-[6px] p-0 text-muted-foreground hover:bg-secondary aria-expanded:bg-secondary"

export function JobHeader({
  job,
  position,
  total,
  onPrevious,
  onNext,
  railOpen,
  onToggleRail,
  onToggleStar,
  onDelete,
}: {
  job: JobDetail
  position: number
  total: number
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  railOpen: boolean
  onToggleRail: () => void
  onToggleStar: () => void
  onDelete: () => void
}) {
  function copyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast("Link copied"))
      .catch(() => toast("Could not copy the link. Try again."))
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-2 border-b border-foreground/6 px-4 py-2 sm:h-[52px] sm:flex-nowrap sm:py-0 sm:ps-5 sm:pe-4"
    >
      <div className="flex min-w-0 basis-full items-center gap-2 sm:contents">
        <Link to="/apply" className="text-[13px] text-muted-foreground">
          Apply
        </Link>
        <ChevronRight
          aria-hidden
          className="size-[13px] text-muted-foreground"
        />
        <span className="flex min-w-0 items-center gap-1.5">
          <Briefcase
            aria-hidden
            className="size-3.5 shrink-0 text-foreground"
          />
          <span className={cn("truncate text-[13px] font-medium", TITLE_TEXT)}>
            {job.title}
          </span>
        </span>
      </div>
      <div className="flex min-w-0 basis-full items-center gap-2 sm:contents">
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
        <span
          className={cn(
            "mr-1.5 text-[12.5px] leading-[15px] whitespace-nowrap",
            FAINT_TEXT.card
          )}
        >
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
        <Button
          type="button"
          variant="ghost"
          aria-label="Copy link"
          className={cn("size-7", ICON_BUTTON)}
          onClick={copyLink}
        >
          <LinkIcon aria-hidden className="size-7 p-[6.5px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label="Properties panel"
          aria-pressed={railOpen}
          className={cn("size-7", ICON_BUTTON)}
          onClick={onToggleRail}
        >
          <PanelRight aria-hidden className="size-7 p-[6.5px]" />
        </Button>
      </div>
    </nav>
  )
}
