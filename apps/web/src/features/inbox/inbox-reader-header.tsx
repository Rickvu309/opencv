import { useQueryClient } from "@tanstack/react-query"
import type { InboxDetail } from "@workspace/domain"
import { Check, ChevronDown, ChevronUp, Clock3, Ellipsis } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderLeading,
  PageHeaderMeta,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"
import { toast, toastWithUndo } from "@workspace/ui/components/sonner"

import { reportRejected } from "@/lib/command-failure.ts"
import { catalogClient, undoActivity } from "@/lib/contract-client.ts"

import { INBOX_MORE_REASON, UNAVAILABLE_ACTION } from "./inbox-parts.tsx"
import { nextMorningIso, SNOOZED_UNTIL_WAKE_TOAST } from "./inbox-time.ts"

export function InboxReaderHeader({
  detail,
  index,
  count,
  narrow,
  busy,
  now,
  zone,
  run,
  onBack,
  onReturnedToInbox,
  onPrevious,
  onNext,
}: {
  detail: InboxDetail
  index: number
  count: number
  narrow: boolean
  busy: boolean
  now: Date
  zone: string
  run: (task: () => Promise<void>) => Promise<void>
  onBack: () => void
  onReturnedToInbox: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  const queryClient = useQueryClient()
  return (
    <PageHeader>
      {narrow ? (
        <PageHeaderLeading>
          <PageHeaderBack
            render={
              <Button
                size="touch"
                type="button"
                variant="ghost"
                aria-label="Back to inbox"
                onClick={onBack}
              />
            }
          >
            Inbox
          </PageHeaderBack>
        </PageHeaderLeading>
      ) : null}
      <PageHeaderTitle
        as={narrow ? "h1" : "div"}
        role={narrow ? undefined : "heading"}
        aria-level={narrow ? undefined : 2}
      >
        {detail.subject}
      </PageHeaderTitle>
      {detail.messages.length > 0 ? (
        <PageHeaderMeta className="tabular-nums">
          {`${detail.messages.length} ${detail.messages.length === 1 ? "message" : "messages"}`}
        </PageHeaderMeta>
      ) : null}
      <PageHeaderMeta showOnPhone className="tabular-nums">
        {`${index} of ${count}`}
      </PageHeaderMeta>
      <PageHeaderActions overflowLabel="More actions">
        <PageHeaderAction
          label="Done"
          icon={<Check />}
          showLabel
          collapse
          disabled={busy}
          onSelect={() =>
            run(async () => {
              const result = await catalogClient.run(
                queryClient,
                "inbox.markDone",
                {
                  threadId: detail.id,
                }
              )
              toastWithUndo("Marked done", () => {
                if ("activityId" in result && result.activityId)
                  void undoActivity(queryClient, result.activityId).catch(
                    reportRejected("undo this")
                  )
              })
            })
          }
        />
        <PageHeaderAction
          label={detail.status === "snoozed" ? "Return to inbox" : "Snooze"}
          icon={<Clock3 />}
          showLabel
          collapse
          disabled={busy}
          onSelect={() =>
            run(async () => {
              if (detail.status === "snoozed") {
                await catalogClient.run(queryClient, "inbox.snooze", {
                  threadId: detail.id,
                  until: null,
                })
                onReturnedToInbox()
                toast("Returned to inbox")
              } else {
                await catalogClient.run(queryClient, "inbox.snooze", {
                  threadId: detail.id,
                  until: nextMorningIso(now, zone),
                })
                toast(SNOOZED_UNTIL_WAKE_TOAST)
              }
            })
          }
        />
        <PageHeaderAction
          label="More"
          icon={<Ellipsis aria-hidden />}
          disabledReason={INBOX_MORE_REASON}
          className={`${UNAVAILABLE_ACTION} active:scale-100 max-md:hidden`}
        />
        <PageHeaderAction
          label="Previous"
          icon={<ChevronUp />}
          collapse
          disabled={index <= 1}
          onSelect={onPrevious}
        />
        <PageHeaderAction
          label="Next"
          icon={<ChevronDown />}
          collapse
          disabled={index >= count}
          onSelect={onNext}
        />
      </PageHeaderActions>
    </PageHeader>
  )
}
