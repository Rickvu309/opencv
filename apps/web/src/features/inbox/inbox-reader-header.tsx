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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { reportRejected } from "@/lib/command-failure.ts"
import { undoActivity, useRunCommand } from "@/lib/contract-client.ts"

import { INBOX_MORE_REASON } from "./inbox-parts.tsx"
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
  const runCommand = useRunCommand()
  return (
    <PageHeader>
      {narrow ? (
        <PageHeaderLeading>
          <PageHeaderBack
            render={
              <Button
                className="h-11 md:h-8"
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
      <PageHeaderTitle as={narrow ? "h1" : "div"}>
        {detail.subject}
      </PageHeaderTitle>
      <PageHeaderMeta showOnPhone>{`${index} of ${count}`}</PageHeaderMeta>
      <PageHeaderActions overflowLabel="More actions">
        <PageHeaderAction
          label="Done"
          icon={<Check />}
          showLabel
          collapse
          disabled={busy}
          onSelect={() =>
            run(async () => {
              const result = await runCommand("inbox.markDone", {
                threadId: detail.id,
              })
              toastWithUndo("Marked done", () => {
                if (result.activityId)
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
                toast(SNOOZED_UNTIL_WAKE_TOAST)
              }
            })
          }
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="inline-flex max-md:hidden"
                data-slot="inbox-more"
              />
            }
          >
            <PageHeaderAction
              label="More"
              icon={<Ellipsis />}
              disabled
              className="pointer-events-none"
            />
          </TooltipTrigger>
          <TooltipContent>
            More has no other actions for this email.
          </TooltipContent>
        </Tooltip>
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
      <span className="sr-only">{INBOX_MORE_REASON}</span>
    </PageHeader>
  )
}
