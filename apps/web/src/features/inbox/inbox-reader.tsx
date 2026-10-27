import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { InboxDetail } from "@workspace/domain"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { toast, toastWithUndo } from "@workspace/ui/components/sonner"
import { Button } from "@workspace/ui/components/button"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { Textarea } from "@workspace/ui/components/textarea"

import { ApiError } from "@/lib/api.ts"
import { PROFILE_ZONE } from "@/features/apply/apply-stages.ts"
import { undoActivity, useRunCommand } from "@/lib/contract-client.ts"

import { InboxLimitError, inboxLimitFrom, isCoachLimit } from "./inbox-api.ts"
import { chipClock, inboxChip, nextMorningIso } from "./inbox-time.ts"

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
  const [body, setBody] = useState(saved)
  const [savedBody, setSavedBody] = useState(saved)
  const [selected, setSelected] = useState(0)
  const [limit, setLimit] = useState<InboxLimitError | null>(null)
  const [busy, setBusy] = useState(false)
  const prompt = Boolean(detail.jobId && detail.suggestedStage === "interview")
  const hasDraft = draft != null
  const sendGlow = hasDraft && !prompt

  function saveDraft(draftBody: string) {
    return runCommand("inbox.updateDraft", {
      threadId: detail.id,
      body: draftBody,
    })
  }

  async function run(task: () => Promise<void>) {
    setBusy(true)
    try {
      await task()
    } catch (error) {
      if (isCoachLimit(error)) {
        setLimit(await inboxLimitFrom(error))
        return
      }
      toast(
        error instanceof ApiError
          ? error.message
          : "Could not load inbox. Refresh the page."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Reading pane"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        {narrow ? (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft />
            Back to inbox
          </Button>
        ) : null}
        <Button
          variant="ghost"
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
          Done
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await runCommand("inbox.snooze", {
                threadId: detail.id,
                until: nextMorningIso(now, zone),
              })
              toast("Snoozed until 7:00")
            })
          }
        >
          Snooze
        </Button>
        <Button variant="ghost" disabled aria-describedby="inbox-gmail-closed">
          Open in Gmail
        </Button>
        <span id="inbox-gmail-closed" className="sr-only">
          Gmail is not connected
        </span>
        <span className="ml-auto text-sm text-muted-foreground">
          {index} of {count}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous"
          disabled={index <= 1}
          onClick={onPrevious}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next"
          disabled={index >= count}
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <h2 className="text-base font-medium">{detail.subject}</h2>
        <div data-user-content className="mt-4 flex flex-col gap-4 text-sm">
          {detail.messages.length === 0 ? <p>{detail.summary}</p> : null}
          {detail.messages.map((message) => (
            <article key={message.id} className="whitespace-pre-wrap">
              <p className="font-medium">{message.fromName}</p>
              <p>{message.bodyText}</p>
            </article>
          ))}
          {detail.job ? (
            <p className="flex items-center gap-2">
              <StageIcon stage={detail.job.stage} />
              Linked to {detail.job.title} in Apply
            </p>
          ) : null}
        </div>
        {prompt ? (
          <div className="mt-6 flex flex-col items-start gap-2">
            <p>Move this job to Interview?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="glow"
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
          </div>
        ) : null}
        {hasDraft ? (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Drafted by opencv</p>
            {limit ? (
              <div role="alert" className="flex flex-col gap-1 text-sm">
                <p>You've reached today's Free limit.</p>
                <p>{limit.message}</p>
                <a
                  href="/app/settings"
                  className="text-foreground underline underline-offset-4"
                >
                  Upgrade
                </a>
              </div>
            ) : null}
            <Textarea
              aria-label="Reply"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onBlur={() => {
                if (body === savedBody) return
                void saveDraft(body)
                  .then(() => setSavedBody(body))
                  .catch((error: unknown) => {
                    toast(
                      error instanceof ApiError
                        ? error.message
                        : "Could not load inbox. Refresh the page."
                    )
                  })
              }}
            />
            {times.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {times.map((time, chip) => (
                  <Button
                    key={time}
                    variant={chip === selected ? "secondary" : "ghost"}
                    aria-pressed={chip === selected}
                    onClick={() => {
                      if (chip === selected) return
                      setSelected(chip)
                      const clock = chipClock(time, zone)
                      const next = body.replace(/\b\d{1,2}:\d{2}\b/, clock)
                      setBody(next)
                      setSavedBody(next)
                      void saveDraft(next)
                    }}
                  >
                    {inboxChip(time, zone)}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                disabled={busy || limit != null}
                onClick={() =>
                  run(async () => {
                    const next = await runCommand("inbox.draftReply", {
                      threadId: detail.id,
                      hint: "another time",
                    })
                    setBody(next.body)
                    setSavedBody(next.body)
                    setLimit(null)
                  })
                }
              >
                {limit
                  ? `Coach is back at ${resetClock(limit.resetsAt, zone)}`
                  : "Suggest another time"}
              </Button>
              <Button
                variant={sendGlow ? "glow" : "ghost"}
                disabled={busy || body.trim() === ""}
                onClick={() =>
                  run(async () => {
                    if (body !== savedBody) {
                      await saveDraft(body)
                      setSavedBody(body)
                    }
                    await runCommand("inbox.send", { threadId: detail.id })
                    toast("Reply sent")
                  })
                }
              >
                Send
              </Button>
              {times.length > 0 ? (
                <Button
                  variant="ghost"
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
                  Add to calendar
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
