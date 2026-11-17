import type { InboxThread } from "@workspace/domain"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { companyInitials } from "@/features/apply/apply-stages.ts"

export const SOFT_TEXT = "text-muted-foreground"
export const FAINT_TEXT = "text-muted-foreground"
export const GMAIL_UNAVAILABLE_LEAD = "Gmail connection isn't available yet."
export const EXPLORE_EXAMPLE_HINT = "You can explore an example inbox."
export const GMAIL_UNAVAILABLE_COPY = `${GMAIL_UNAVAILABLE_LEAD} ${EXPLORE_EXAMPLE_HINT}`
export const EXAMPLE_MAIL_BANNER =
  "Example emails, not yours. Gmail connection isn't available yet."
export const UNAVAILABLE_ACTION =
  "aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
export const VIEW_EXAMPLE_LABEL = "View example inbox"
export const INBOX_MORE_REASON = "No other actions for this email."
export const NO_GMAIL_LINK = "No Gmail link for this email."
export const ACTION_FAILED = "Could not complete that action. Try again."
export const INBOX_NOTICE =
  "rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm leading-normal text-pretty text-foreground"

export function GmailMark({ className }: { className?: string }) {
  return (
    <img
      src="/brands/gmail.svg"
      alt=""
      aria-hidden="true"
      className={cn("shrink-0", className)}
    />
  )
}

export function InboxRow({
  thread,
  time,
  active,
  onOpen,
}: {
  thread: InboxThread
  time: string
  active: boolean
  onOpen: () => void
}) {
  const unread = thread.unread && thread.status === "open"
  return (
    <Button
      variant="ghost"
      className={cn(
        "h-11 w-full justify-start gap-2.5 rounded-[10px] py-0 ps-2.5 pe-3.5 text-left text-[13px] font-normal hover:bg-muted/60",
        active && "bg-muted hover:bg-muted"
      )}
      data-slot="inbox-row"
      aria-label={`${thread.role}, ${thread.company}, ${thread.summary}`}
      aria-current={active ? "true" : undefined}
      onClick={onOpen}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.75 shrink-0 rounded-full",
          unread ? "bg-foreground" : "bg-transparent"
        )}
      />
      <Avatar size="sm">
        <AvatarFallback className="bg-accent text-[8.5px] font-semibold">
          {companyInitials(thread.company)}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "w-27 shrink-0 truncate font-semibold",
          unread ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {thread.company}
      </span>
      <span className="min-w-0 flex-1 truncate">{thread.summary}</span>
      <span className={cn("w-10 shrink-0 text-right text-xs", FAINT_TEXT)}>
        {time}
      </span>
    </Button>
  )
}

const SKELETON_BARS = [
  [150, 220],
  [187, 273],
  [224, 236],
  [181, 289],
  [218, 252],
  [175, 305],
] as const

export function InboxSkeletonRows() {
  return (
    <ul aria-hidden className="flex flex-col gap-0.5 p-2">
      {SKELETON_BARS.map(([top, bottom], row) => (
        <li
          key={top}
          className="flex h-14.5 items-center gap-3 px-3"
          style={{ opacity: row === 1 ? 0.86 : row === 2 ? 0.72 : undefined }}
        >
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton
              className="h-2 max-w-full rounded-sm"
              style={{ width: top }}
            />
            <Skeleton
              className="h-1.75 max-w-full rounded-sm opacity-60"
              style={{ width: bottom }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function CompanyChip({ name }: { name: string }) {
  return (
    <li data-slot="company-tile" title={name}>
      <Avatar className="size-6.5 motion-safe:animate-pulse motion-reduce:animate-none">
        <AvatarFallback className="bg-accent text-[9px] font-semibold">
          {companyInitials(name)}
        </AvatarFallback>
      </Avatar>
    </li>
  )
}
