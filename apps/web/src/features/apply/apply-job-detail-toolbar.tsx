import type { PaperDoc } from "@workspace/domain"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { Link2 } from "lucide-react"
import type { ReactNode } from "react"

import { STAGES, type StageId } from "@/features/apply/apply-types.ts"

export function PaperLinkMenu({
  open,
  onOpenChange,
  cardId,
  docs,
  onLink,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cardId: string
  docs: PaperDoc[]
  onLink: (docId: string, applyCardId: string | null) => void
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Link Paper docs"
            className={cn(
              "text-muted-foreground",
              (open || docs.some((doc) => doc.applyCardId === cardId)) &&
                "bg-muted text-foreground"
            )}
          />
        }
      >
        <Link2 className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        aria-label="Link Paper docs"
        className="max-h-64 w-64"
      >
        {docs.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No Paper docs yet.
          </p>
        ) : (
          docs.map((doc) => {
            const linkedHere = doc.applyCardId === cardId
            return (
              <DropdownMenuCheckboxItem
                key={doc.id}
                checked={linkedHere}
                onCheckedChange={() =>
                  onLink(doc.id, linkedHere ? null : cardId)
                }
              >
                <span className="min-w-0 flex-1 truncate">{doc.name}</span>
              </DropdownMenuCheckboxItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StageMenu({
  value,
  label,
  onChange,
}: {
  value: StageId
  label: string
  onChange: (stage: StageId) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Stage: ${label}`}
            className="h-8 text-xs font-medium text-muted-foreground"
          />
        }
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[8.5rem]">
        {STAGES.map((stage) => (
          <DropdownMenuItem
            key={stage.id}
            onClick={() => onChange(stage.id)}
            className={cn(value === stage.id && "bg-muted font-medium")}
          >
            <span className={cn("size-1.5 rounded-full", stage.dot)} />
            {stage.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ToolbarIconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        "text-muted-foreground"
      )}
    >
      {children}
    </a>
  )
}

export function ToolbarIconButton({
  label,
  onClick,
  children,
  active,
  className,
  disabled,
}: {
  label: string
  onClick?: () => void
  children?: ReactNode
  active?: boolean
  className?: string
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Coming soon" : undefined}
      className={cn(
        "text-muted-foreground",
        active && "bg-muted text-foreground",
        className
      )}
    >
      {children}
    </Button>
  )
}
