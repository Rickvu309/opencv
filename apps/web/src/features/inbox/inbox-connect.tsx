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
import { cn } from "@workspace/ui/lib/utils"

import { FAINT_TEXT, GmailMark, SOFT_TEXT } from "./inbox-parts.tsx"

const TILE =
  "flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-linear-to-b from-card to-secondary shadow-md"
const CARD =
  "flex w-100 flex-col gap-3 rounded-[14px] border border-border bg-card p-4.5 shadow-lg"

const BENEFITS = [
  {
    icon: Inbox,
    title: "Replies, sorted.",
    text: "Recruiter emails land here, not lost in Promotions.",
  },
  {
    icon: Kanban,
    title: "Board stays current.",
    text: "Invites move jobs to Live. Rejections close them.",
  },
  {
    icon: Send,
    title: "Follow-ups, written.",
    text: "Send a ready follow-up in one click.",
  },
] as const

export function InboxTitleBar() {
  return (
    <div
      data-pen-section="Header"
      className="flex h-13 shrink-0 items-center border-b border-border px-5"
    >
      <h1 className="text-[13px] font-medium text-foreground">Inbox</h1>
    </div>
  )
}

export function InboxConnect({
  url,
  pending,
  onSkip,
}: {
  url: string | null
  pending: boolean
  onSkip: () => void
}) {
  const closed = url == null
  return (
    <div data-pen-section="Split" className="flex min-h-0 flex-1 gap-4 p-4">
      <section className="flex min-w-0 flex-1 flex-col justify-center gap-8 overflow-y-auto ps-16 pe-14 max-md:p-4">
        <div className="flex items-center">
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
        <div className="flex flex-col gap-3">
          <h2 className="text-[32px] font-semibold tracking-[-1.1px] text-foreground">
            Never miss a recruiter reply
          </h2>
          <p
            data-user-content
            className="max-w-105 text-[15px] leading-relaxed text-muted-foreground"
          >
            Job emails, matched to your applications.
          </p>
        </div>
        <ul className="flex flex-col gap-4.5">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex items-center gap-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-xs">
                <benefit.icon className="size-4.25" aria-hidden />
              </span>
              <div className="flex flex-col gap-0.75">
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
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-4.5">
            <Button
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
            <Button
              variant="ghost"
              className={cn("px-2 text-[13.5px]", SOFT_TEXT)}
              disabled={pending}
              onClick={onSkip}
            >
              Skip for now
            </Button>
          </div>
          <p
            data-user-content
            className={cn("flex items-center gap-1.75 text-xs", FAINT_TEXT)}
          >
            <Lock className="size-3.25 shrink-0" aria-hidden />
            Reads job emails only. Nothing is sent without you.
          </p>
          {closed ? (
            <p id="inbox-gmail-hint" className="text-sm text-muted-foreground">
              Gmail is not connected on this server. You can skip for now.
            </p>
          ) : null}
        </div>
      </section>
      <aside
        aria-label="Example"
        className="relative flex w-150 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary max-xl:hidden"
      >
        <img
          src="/inbox/connect-backdrop.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover brightness-110 grayscale"
        />
        <div className="relative flex flex-col items-center">
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
                  Sent
                </span>
                <ArrowRight className="size-3.25 text-muted-foreground/80" />
                <span className="flex h-6 items-center gap-1.25 rounded-full bg-foreground px-2.5 text-xs font-semibold text-background">
                  <MessagesSquare className="size-3" />
                  Live
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
    <div className={cn("flex w-110", side === "start" ? "pe-10" : "ps-10")}>
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
