import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import type { PaperDocStatus } from "@workspace/domain"
import { ChevronDown, Globe } from "lucide-react"

export function PaperEditorStatusPill({
  status,
  onChange,
}: {
  status: PaperDocStatus
  onChange: (status: PaperDocStatus) => void
}) {
  const label =
    status === "published"
      ? "Published"
      : status === "ready"
        ? "Ready"
        : "Draft"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
          status === "published" && "border-border bg-muted text-foreground",
          status === "ready" &&
            "border-border bg-secondary text-secondary-foreground",
          status === "draft" &&
            "border-border bg-muted/40 text-muted-foreground"
        )}
        aria-label="Document status"
      >
        {status === "published" ? <Globe className="size-3.5" /> : null}
        {label}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange("draft")}>
          Draft
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("ready")}>
          Ready
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("published")}>
          Published
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
