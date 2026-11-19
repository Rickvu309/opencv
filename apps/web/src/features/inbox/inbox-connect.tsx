import type { ReactNode } from "react"
import {
  ArrowRight,
  CalendarCheck,
  Inbox,
  Kanban,
  Link,
  Lock,
  MessagesSquare,
  Pencil,
  Reply,
  Send,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Mark } from "@workspace/ui/components/brand"
import { PageHeaderTitle } from "@workspace/ui/components/page-header"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import { cn } from "@workspace/ui/lib/utils"

import {
  EXPLORE_EXAMPLE_HINT,
  FAINT_TEXT,
  GMAIL_UNAVAILABLE_LEAD,
  GmailMark,
  SOFT_TEXT,
  VIEW_EXAMPLE_LABEL,
} from "./inbox-parts.tsx"

const TILE =
  "flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-linear-to-b from-card to-secondary shadow-md"
const CARD =
  "flex w-100 max-w-[400px] flex-col gap-3 rounded-[14px] border border-border bg-card p-4.5 shadow-lg"

const BENEFITS = [
  {
    icon: Inbox,
    title: "Replies, sorted.",
    text: "Recruiter emails land here, not lost in Promotions.",
  },
  {
    icon: Kanban,
    title: "Board stays current.",
    text: "Invites move jobs to Interview. Rejections close them.",
  },
  {
    icon: Send,
    title: "Follow-ups, written.",
    text: "Send a ready follow-up in one click.",
  },
] as const

export function InboxTitleBar() {
  return (
    <WorkspaceHeader data-layout-section="Header">
      <PageHeaderTitle>Inbox</PageHeaderTitle>
    </WorkspaceHeader>
  )
}

export function InboxConnect({
  url,
  pending,
  onSkip,
  onExplore,
}: {
  url: string | null
  pending: boolean
  onSkip: () => void
  onExplore: () => void
}) {
  const closed = url == null
  return (
    <div data-layout-section="Split" className="flex min-h-0 flex-1 gap-4 p-4">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto ps-16 pe-14 max-md:p-4">
        <div className="my-auto flex min-w-0 flex-col gap-8 max-md:gap-4">
          <div className="flex max-w-full flex-wrap items-center">
            <span className={TILE}>
              <GmailMark className="h-5 w-7" />
            </span>
            <span className="relative h-14 w-21" aria-hidden>
              <span className="absolute inset-x-0 top-6.75 h-0.5 rounded-full bg-linear-to-r from-transparent via-muted-foreground/40 to-transparent" />
              <span className="absolute top-3.5 left-7 flex size-7 items-center justify-center rounded-full bg-foreground text-background shadow-md">
                <Link className="size-3.5" />
              </span>
            </span>
            <span className={TILE}>
              <Mark size={28} />
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-3 max-md:gap-2">
            <h2 className="max-w-full min-w-0 text-[32px] font-semibold tracking-[-1.1px] wrap-break-word text-foreground">
              Never miss a recruiter reply
            </h2>
            <p
              data-user-content
              className="max-w-105 text-[15px] leading-relaxed text-muted-foreground"
            >
              Job emails, matched to your applications.
            </p>
          </div>
          <ul className="flex flex-col gap-4.5 max-md:gap-3">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="flex min-w-0 items-center gap-3.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-xs">
                  <benefit.icon className="size-4.25" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-0.75">
                  <p className="text-sm font-semibold text-foreground">
                    {benefit.title}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {benefit.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3.5 max-md:gap-2">
            <div className="flex max-w-full flex-wrap items-center gap-3">
              {closed ? (
                <Button
                  variant="primary"
                  className="h-11 gap-2.5 rounded-[10px] ps-3.5 pe-4.5 text-[14.5px] shadow-xs"
                  disabled={pending}
                  aria-describedby="inbox-gmail-hint"
                  onClick={onExplore}
                >
                  {VIEW_EXAMPLE_LABEL}
                </Button>
              ) : null}
              <Button
                variant={closed ? "outline" : "default"}
                className="h-11 gap-2.5 rounded-[10px] ps-3.5 pe-4.5 text-[14.5px] shadow-xs"
                disabled={closed}
                aria-describedby={closed ? "inbox-gmail-hint" : undefined}
                onClick={() => {
                  if (url) window.location.assign(url)
                }}
              >
                <GmailMark className="h-4 w-5.5" />
                Connect Gmail
              </Button>
              {closed ? null : (
                <Button
                  variant="ghost"
                  className={cn(
                    "-ms-2 h-11 px-2 text-[13.5px] md:h-8",
                    SOFT_TEXT
                  )}
                  disabled={pending}
                  onClick={onSkip}
                >
                  Skip for now
                </Button>
              )}
            </div>
            {closed ? (
              <div className="flex items-baseline justify-between gap-3 md:flex-col md:items-start md:gap-3.5">
                <p
                  id="inbox-gmail-hint"
                  className="max-w-105 min-w-0 text-sm leading-normal text-pretty text-foreground"
                >
                  {GMAIL_UNAVAILABLE_LEAD}{" "}
                  <span className="max-md:hidden">{EXPLORE_EXAMPLE_HINT}</span>
                </p>
                <Button
                  variant="ghost"
                  className={cn(
                    "-ms-2 h-11 w-fit shrink-0 px-2 text-[13.5px] md:h-8",
                    SOFT_TEXT
                  )}
                  disabled={pending}
                  onClick={onSkip}
                >
                  Skip for now
                </Button>
              </div>
            ) : null}
            <p
              data-user-content
              className={cn("flex items-center gap-1.75 text-xs", FAINT_TEXT)}
            >
              <Lock className="size-3.25 shrink-0" aria-hidden />
              Reads job emails only. Nothing is sent without you.
            </p>
          </div>
        </div>
      </section>
      <aside
        aria-hidden="true"
        className="relative flex w-150 max-w-[600px] shrink-0 flex-col overflow-y-auto rounded-2xl border border-border bg-secondary max-xl:hidden"
      >
        <img
          src="/inbox/connect-backdrop.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover brightness-110 grayscale"
        />
        <div className="relative my-auto flex flex-col items-center">
          <Slot side="start">
            <div className={CARD}>
              <div className="flex items-center gap-2.5">
                <span className="flex size-7.5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  HT
                </span>
                <div className="flex flex-col gap-px">
                  <p className="text-[13px] font-semibold text-foreground">
                    Hanh Tran
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    Recruiter, Regional bank
                  </p>
                </div>
                <span className="flex-1" />
                <GmailMark className="h-3.75 w-5" />
              </div>
              <p className="text-[13.5px] text-foreground">
                Can you do a 20 minute call on Thursday afternoon?
              </p>
              <p className="flex h-5.5 w-fit items-center gap-1.25 rounded-md bg-muted px-2 text-[11.5px] font-medium text-foreground">
                <CalendarCheck className="size-3" />
                Interview request
              </p>
            </div>
          </Slot>
          <Connector label="Linked to your application" icon={Link} />
          <Slot side="end">
            <div className={CARD}>
              <div className="flex items-center gap-2.5">
                <span className="flex size-7.5 items-center justify-center rounded-lg border border-border bg-card text-[10px] font-semibold">
                  RB
                </span>
                <div className="flex flex-col gap-px">
                  <p className="text-[13px] font-semibold text-foreground">
                    Business Analyst
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    Regional bank
                  </p>
                </div>
                <span className="flex-1" />
                <span className="text-[11.5px] font-medium text-muted-foreground">
                  Apply
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 items-center gap-1.25 rounded-full px-2.5 text-xs text-muted-foreground">
                  <Send className="size-3" />
                  Applied
                </span>
                <ArrowRight className="size-3.25 text-muted-foreground/80" />
                <span className="flex h-6 items-center gap-1.25 rounded-full bg-foreground px-2.5 text-xs font-semibold text-background">
                  <MessagesSquare className="size-3" />
                  Interview
                </span>
                <span className="flex-1" />
                <span className="text-[11.5px] text-muted-foreground">
                  Moved automatically
                </span>
              </div>
            </div>
          </Slot>
          <Connector label="Reply drafted for you" icon={Pencil} />
          <Slot side="start">
            <div className={CARD}>
              <p className="text-[13.5px] text-foreground">
                Hi Hanh, Thursday at 14:30 works for me. Best, Linh
              </p>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <Reply className="size-3" />
                  To Hanh Tran
                </span>
                <span className="flex-1" />
                <span className="flex h-7 items-center rounded-[7px] px-2.5 text-xs font-medium text-foreground">
                  Edit
                </span>
                <span className="flex h-7 items-center gap-1.25 rounded-[7px] bg-foreground px-2.75 text-xs font-medium text-background">
                  <Send className="size-3" />
                  Send
                </span>
              </div>
            </div>
          </Slot>
        </div>
      </aside>
    </div>
  )
}

function Slot({
  side,
  children,
}: {
  side: "start" | "end"
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex w-110 max-w-[440px]",
        side === "start" ? "pe-10" : "ps-10"
      )}
    >
      {children}
    </div>
  )
}

function Connector({
  label,
  icon: Icon,
}: {
  label: string
  icon: typeof Link
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="size-2.25 rounded-full border-2 border-muted-foreground/50 bg-card" />
      <span className="h-5.5 w-0.5 bg-card shadow-xs" />
      <span className="flex h-7 items-center gap-1.5 rounded-full border border-card bg-card/90 px-3 text-[11.5px] font-medium text-muted-foreground shadow-sm">
        <Icon className="size-3" />
        {label}
      </span>
      <span className="h-5.5 w-0.5 bg-card shadow-xs" />
      <span className="size-2.25 rounded-full border-2 border-card bg-foreground" />
    </div>
  )
}
