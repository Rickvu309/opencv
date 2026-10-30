import { useReducer } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { InboxDetail } from "@workspace/domain"
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Ellipsis,
  Reply,
  Send,
  User,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { toast, toastWithUndo } from "@workspace/ui/components/sonner"
import { Button } from "@workspace/ui/components/button"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { ApiError } from "@/lib/api.ts"
import {
  PROFILE_ZONE,
  companyInitials,
  stageLabel,
} from "@/features/apply/apply-stages.ts"
import { undoActivity, useRunCommand } from "@/lib/contract-client.ts"

import { inboxLimitFrom, isCoachLimit } from "./inbox-api.ts"
import { initialReaderState, readerReducer } from "./inbox-reader.reducer.ts"
import {
  FAINT_TEXT,
  GmailMark,
  InboxIconButton,
  SOFT_TEXT,
} from "./inbox-parts.tsx"
import {
  chipClock,
  inboxChip,
  inboxStamp,
  inboxWhen,
  nextMorningIso,
} from "./inbox-time.ts"

function resetClock(iso: string | null, zone: string) {
  if (!iso) return "later"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "later"
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  })
}

export function InboxReader({
  detail,
  index,
  count,
  narrow,
  now,
  zone = PROFILE_ZONE,
  onBack,
  onReturnedToInbox,
  onPrevious,
  onNext,
}: {
  detail: InboxDetail
  index: number
  count: number
  narrow: boolean
  now: Date
  zone?: string
  onBack: () => void
  onReturnedToInbox: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  const draft =
    detail.draft && (detail.draft.body !== "" || detail.draft.times.length > 0)
      ? detail.draft
      : null
  const queryClient = useQueryClient()
  const runCommand = useRunCommand()
  const saved = draft?.body ?? ""
  const times = draft?.times ?? []
  const [
    { body, savedBody, receivedBody, selected, limit, busy, opened },
    dispatch,
  ] = useReducer(readerReducer, saved, initialReaderState)
  if (receivedBody !== saved) {
    dispatch({ type: "draft_received", body: saved })
  }
  const prompt = Boolean(detail.jobId && detail.suggestedStage === "interview")
  const hasDraft = draft != null
  const earlier = detail.messages.slice(0, -1)
  const current = detail.messages.at(-1) ?? null
  const inbound = detail.messages.findLast(
    (message) => message.direction === "in"
  )
  const me = detail.messages.find((message) => message.direction === "out")

  function saveDraft(draftBody: string) {
    return runCommand("inbox.updateDraft", {
      threadId: detail.id,
      body: draftBody,
    })
  }

  async function run(task: () => Promise<void>) {
    dispatch({ type: "task_started" })
    try {
      await task()
    } catch (error) {
      if (isCoachLimit(error)) {
        dispatch({ type: "limit_reached", limit: await inboxLimitFrom(error) })
        return
      }
      toast(
        error instanceof ApiError
          ? error.message
          : "Could not load inbox. Refresh the page."
      )
    } finally {
      dispatch({ type: "task_ended" })
    }
  }

  return (
    <section
      aria-label="Reading pane"
      data-pen-section="Detail pane"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div className="flex h-13 shrink-0 items-center gap-1 border-b border-border ps-9.5 pe-12 max-md:h-auto max-md:min-h-13 max-md:flex-wrap max-md:px-3 max-md:py-1.5">
        {narrow ? (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft />
            Back to inbox
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className={TOOLBAR_BUTTON}
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = await runCommand("inbox.markDone", {
                threadId: detail.id,
              })
              toastWithUndo("Marked done", () => {
                if (result.activityId)
                  void undoActivity(queryClient, result.activityId)
              })
            })
          }
        >
          <Check className="size-3.75" />
          Done
        </Button>
        <Button
          variant="ghost"
          className={TOOLBAR_BUTTON}
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (detail.status === "snoozed") {
                await runCommand("inbox.snooze", {
                  threadId: detail.id,
                  until: null,
                })
                onReturnedToInbox()
                toast("Returned to inbox")
              } else {
                await runCommand("inbox.snooze", {
                  threadId: detail.id,
                  until: nextMorningIso(now, zone),
                })
                toast("Snoozed until 7:00")
              }
            })
          }
        >
          <Clock3 className="size-3.75" />
          {detail.status === "snoozed" ? "Return to inbox" : "Snooze"}
        </Button>
        <InboxIconButton
          label="More"
          className="size-7.5 rounded-[7px] max-md:hidden"
          disabled
        >
          <Ellipsis />
        </InboxIconButton>
        <span className="flex-1" />
        <span
          className={cn("shrink-0 text-[12.5px] whitespace-nowrap", SOFT_TEXT)}
        >
          {`${index} of ${count}`}
        </span>
        <span className="ps-2" />
        <Button
          variant="default"
          size="icon-sm"
          className="size-7 rounded-[7px]"
          aria-label="Previous"
          disabled={index <= 1}
          onClick={onPrevious}
        >
          <ChevronUp className="size-3.25" />
        </Button>
        <Button
          variant="default"
          size="icon-sm"
          className="size-7 rounded-[7px]"
          aria-label="Next"
          disabled={index >= count}
          onClick={onNext}
        >
          <ChevronDown className="size-3.25" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-12 pt-7 pb-6 max-md:px-5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {detail.subject}
          </h2>
          {detail.messages.length > 0 ? (
            <span className={cn("text-[13px]", FAINT_TEXT)}>
              {`${detail.messages.length} ${detail.messages.length === 1 ? "message" : "messages"}`}
            </span>
          ) : null}
          <span className="flex-1" />
          <Button
            variant="ghost"
            className={cn(
              "h-7 gap-1.5 rounded-[7px] px-2.5 text-[12.5px]",
              SOFT_TEXT
            )}
            disabled
            aria-describedby="inbox-gmail-closed"
          >
            <GmailMark className="h-3.75 w-5" />
            Open in Gmail
            <ArrowUpRight className="size-3" />
          </Button>
          <span id="inbox-gmail-closed" className="sr-only">
            Gmail is not connected
          </span>
        </div>
        {prompt ? (
          <div className="flex min-h-11 items-center gap-x-2 gap-y-1 rounded-[10px] border border-border py-1.5 ps-3 pe-1.5 max-md:flex-wrap">
            <CalendarCheck className="size-4 text-foreground" aria-hidden />
            <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[13px]">
              <span className="font-medium text-foreground">
                Interview request
              </span>
              <span className="text-muted-foreground">
                {detail.job
                  ? `Move this job from ${stageLabel(detail.job.stage)} to Interview?`
                  : "Move this job to Interview?"}
              </span>
            </p>
            <Button
              className="h-7 shrink-0 rounded-[7px] px-2.5 text-[12.5px]"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await runCommand("inbox.acceptSuggestion", {
                    threadId: detail.id,
                  })
                  toastWithUndo("Moved to Interview", () => {
                    if (result.activityId)
                      void undoActivity(queryClient, result.activityId)
                  })
                })
              }
            >
              Move to Interview
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "h-7 rounded-[7px] px-2.5 text-[12.5px]",
                SOFT_TEXT
              )}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await runCommand("inbox.clearSuggestion", {
                    threadId: detail.id,
                  })
                })
              }
            >
              Not now
            </Button>
          </div>
        ) : detail.job ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <StageIcon stage={detail.job.stage} />
            {`Linked to ${detail.job.title} in Apply`}
          </p>
        ) : null}
        <div data-user-content className="flex flex-col">
          {detail.messages.length === 0 ? (
            <p className="text-sm">{detail.summary}</p>
          ) : null}
          {earlier.length > 0 ? (
            <div className="border-t border-border/60">
              {earlier.map((message) => {
                const open = opened.has(message.id)
                return (
                  <div key={message.id} className="border-b border-border/60">
                    <Button
                      type="button"
                      variant="ghost"
                      aria-expanded={open}
                      className="h-13 w-full justify-start gap-3 rounded-none px-0 text-left font-normal hover:bg-transparent"
                      onClick={() =>
                        dispatch({ type: "earlier_toggled", id: message.id })
                      }
                    >
                      <PersonAvatar name={message.fromName} />
                      <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
                        {message.fromName}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[13px]",
                          FAINT_TEXT
                        )}
                      >
                        {open ? "" : message.bodyText}
                      </span>
                      <span className={cn("shrink-0 text-xs", FAINT_TEXT)}>
                        {inboxWhen(message.sentAt, now, zone)}
                      </span>
                    </Button>
                    {open ? <Paragraphs text={message.bodyText} /> : null}
                  </div>
                )
              })}
            </div>
          ) : null}
          {current ? (
            <article className="flex flex-col gap-3.5 pt-4.5 pb-1">
              <header className="flex flex-wrap items-center gap-3">
                <PersonAvatar name={current.fromName} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-[13.5px] font-semibold text-foreground">
                      {current.fromName}
                    </span>
                    <span className={cn("text-[12.5px]", SOFT_TEXT)}>
                      {`<${current.fromEmail}>`}
                    </span>
                  </p>
                  <p
                    className={cn("flex items-center gap-1 text-xs", SOFT_TEXT)}
                  >
                    {current.direction === "in"
                      ? "to me"
                      : `to ${current.toEmail}`}
                    <ChevronDown
                      className={cn("size-2.5", FAINT_TEXT)}
                      aria-hidden
                    />
                  </p>
                </div>
                <span className="flex-1" />
                <span className={cn("text-xs", SOFT_TEXT)}>
                  {inboxStamp(current.sentAt, now, zone)}
                </span>
              </header>
              <Paragraphs text={current.bodyText} />
            </article>
          ) : null}
        </div>
        {hasDraft ? (
          <div className="flex gap-3 max-md:[&>[data-slot=avatar]]:hidden">
            {me ? (
              <PersonAvatar name={me.fromName} />
            ) : (
              <Avatar>
                <AvatarFallback className="bg-muted">
                  <User className="size-4" aria-hidden />
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {inbound ? (
                <p className="flex h-9 min-w-0 items-center gap-2 px-4 pt-1 text-[12.5px]">
                  <Reply className={cn("size-3.25", SOFT_TEXT)} aria-hidden />
                  <span className="shrink-0 font-medium whitespace-nowrap text-foreground">
                    {inbound.fromName}
                  </span>
                  <span className={cn("min-w-0 truncate", SOFT_TEXT)}>
                    {`<${inbound.fromEmail}>`}
                  </span>
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1.5">
                {times.map((time, chip) => (
                  <Button
                    key={time}
                    variant={chip === selected ? "default" : "outline"}
                    className={cn(CHIP, chip === selected && CHIP_ON)}
                    aria-pressed={chip === selected}
                    onClick={() => {
                      if (chip === selected) return
                      const clock = chipClock(time, zone)
                      const next = body.replace(/\b\d{1,2}:\d{2}\b/, clock)
                      dispatch({ type: "time_chosen", index: chip, body: next })
                      void saveDraft(next)
                    }}
                  >
                    {inboxChip(time, zone)}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className={CHIP}
                  disabled={busy || limit != null}
                  onClick={() =>
                    run(async () => {
                      const next = await runCommand("inbox.draftReply", {
                        threadId: detail.id,
                        hint: "another time",
                      })
                      dispatch({ type: "reply_suggested", body: next.body })
                    })
                  }
                >
                  {limit
                    ? `Coach is back at ${resetClock(limit.resetsAt, zone)}`
                    : "Suggest another time"}
                </Button>
              </div>
              {limit ? (
                <div
                  role="alert"
                  className="flex flex-col gap-1 px-4 pt-3 text-sm"
                >
                  <p>You've reached today's Free limit.</p>
                  <p>{limit.message}</p>
                  <a
                    href="/settings"
                    className="text-foreground underline underline-offset-4"
                  >
                    Upgrade
                  </a>
                </div>
              ) : null}
              <div className="px-4 py-3.5">
                <Textarea
                  aria-label="Reply"
                  disabled={busy}
                  className="min-h-0 resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
                  value={body}
                  onChange={(event) =>
                    dispatch({ type: "reply_typed", value: event.target.value })
                  }
                  onBlur={() => {
                    if (body === savedBody) return
                    void saveDraft(body)
                      .then(() =>
                        dispatch({ type: "draft_saved", body, receivedBody })
                      )
                      .catch((error: unknown) => {
                        toast(
                          error instanceof ApiError
                            ? error.message
                            : "Could not load inbox. Refresh the page."
                        )
                      })
                  }}
                />
              </div>
              <div className="flex h-12 items-center gap-1.5 ps-4 pe-3">
                <Button
                  className="h-8 gap-1.5 rounded-lg border-transparent bg-foreground px-3 text-[12.5px] font-semibold text-background ring-0 hover:bg-foreground/90"
                  disabled={busy || body.trim() === ""}
                  onClick={() =>
                    run(async () => {
                      if (body !== savedBody) {
                        await saveDraft(body)
                        dispatch({ type: "draft_saved", body, receivedBody })
                      }
                      await runCommand("inbox.send", { threadId: detail.id })
                      dispatch({ type: "reply_sent", body })
                      toast("Reply sent")
                    })
                  }
                >
                  <Send className="size-3.25" />
                  Send
                </Button>
                {times.length > 0 ? (
                  <Button
                    variant="ghost"
                    className="h-7 gap-1.75 rounded-md px-2 text-[12.5px] font-normal text-muted-foreground"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const start = times[selected]
                        if (!start) return
                        await runCommand("inbox.addToCalendar", {
                          threadId: detail.id,
                          start,
                        })
                        toast("Added to calendar")
                      })
                    }
                  >
                    <CalendarCheck className="size-4" />
                    Add to calendar
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

const TOOLBAR_BUTTON =
  "h-7.5 gap-1.5 rounded-[7px] px-2.5 text-[12.5px] text-foreground/85"
const CHIP = "h-6.5 rounded-full px-2.5 text-xs"
const CHIP_ON =
  "border-transparent bg-foreground text-background ring-0 hover:bg-foreground/90"

function PersonAvatar({ name }: { name: string }) {
  return (
    <Avatar>
      <AvatarFallback className="bg-accent text-[10.5px] font-semibold">
        {companyInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3.5 ps-11 text-sm leading-relaxed text-foreground max-md:ps-0">
      {text.split(/\n{2,}/).map((paragraph, at) => (
        <p
          key={`${at}-${paragraph.slice(0, 12)}`}
          className="whitespace-pre-wrap"
        >
          {paragraph}
        </p>
      ))}
    </div>
  )
}
