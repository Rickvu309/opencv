import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ERROR_CODES, jobIdSchema, type JobId } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { travelToken } from "@workspace/ui/lib/motion"

import { ApiError } from "@/lib/api-error.ts"
import { useShortcut } from "@/lib/use-shortcut.ts"

import { getJob, jobGetKey, prefetchJob } from "./apply-api.ts"
import { useJobActions } from "./apply-job-actions.ts"
import { JobRail } from "./apply-job-rail.tsx"
import { ApplyPeekHeader } from "./apply-peek-header.tsx"

const PEEK_NOTICE = "flex flex-col items-start gap-3 px-5 py-5 text-sm"

export function ApplyPeek({
  jobId,
  order,
  onOpen,
  onClose,
}: {
  jobId: string
  order: readonly JobId[]
  onOpen: (jobId: JobId) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const panel = useRef<HTMLElement>(null)
  const parsed = jobIdSchema.safeParse(jobId)
  const id = parsed.success ? parsed.data : null
  const index = id ? order.indexOf(id) : -1
  const previous = index > 0 ? order[index - 1] : undefined
  const next = index >= 0 ? order[index + 1] : undefined

  useEffect(() => {
    if (previous) prefetchJob(queryClient, previous)
    if (next) prefetchJob(queryClient, next)
  }, [queryClient, previous, next])

  function close() {
    const element = panel.current
    const { duration, easing } = travelToken("micro")
    if (!element || duration <= 0 || typeof element.animate !== "function") {
      onClose()
      return
    }
    element
      .animate(
        [
          { opacity: 1, translate: "0 0" },
          { opacity: 0, translate: "24px 0" },
        ],
        { duration, easing, fill: "forwards" }
      )
      .finished.then(onClose, onClose)
  }

  function step(target: JobId | undefined) {
    if (target) onOpen(target)
  }

  useShortcut({ key: "j", onPress: () => step(next) })
  useShortcut({ key: "k", onPress: () => step(previous) })
  useShortcut({ key: "ArrowDown", onPress: () => step(next) })
  useShortcut({ key: "ArrowUp", onPress: () => step(previous) })
  useShortcut({ key: "Escape", onPress: close })

  return (
    <aside
      ref={panel}
      aria-label="Job"
      data-slot="apply-peek"
      className="absolute inset-y-0 right-0 z-20 flex w-full motion-peek flex-col border-l border-foreground/6 bg-card shadow-[-12px_0_32px_rgb(0_0_0/0.05)] sm:w-[420px]"
    >
      <ApplyPeekHeader
        position={index >= 0 ? `${index + 1} / ${order.length}` : null}
        jobId={id}
        onPrevious={previous ? () => step(previous) : null}
        onNext={next ? () => step(next) : null}
        onClose={close}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {id ? (
          <PeekBody key={id} jobId={id} onClose={close} />
        ) : (
          <p className={PEEK_NOTICE}>This job link isn't valid.</p>
        )}
      </div>
    </aside>
  )
}

function PeekBody({ jobId, onClose }: { jobId: JobId; onClose: () => void }) {
  const actions = useJobActions(jobId)
  const detail = useQuery({
    queryKey: jobGetKey(jobId),
    queryFn: () => getJob(jobId),
  })
  const job = detail.data

  if (detail.isLoading) {
    return (
      <p role="status" className={PEEK_NOTICE}>
        Loading job
      </p>
    )
  }
  if (
    detail.error instanceof ApiError &&
    detail.error.code === ERROR_CODES.NOT_FOUND
  ) {
    return (
      <div className={PEEK_NOTICE}>
        <p>Job not found.</p>
        <Button type="button" className="h-11 md:h-8" onClick={onClose}>
          Close
        </Button>
      </div>
    )
  }
  if (detail.isError || !job) {
    return (
      <div className={PEEK_NOTICE}>
        <p>Couldn't load this job.</p>
        <Button
          type="button"
          className="h-11 md:h-8"
          onClick={() => void detail.refetch()}
        >
          Refresh
        </Button>
      </div>
    )
  }

  return (
    <div data-slot="apply-peek-body" className="flex flex-col motion-fade-in">
      <div className="px-5 pt-5 pb-2">
        <p className="text-[12.5px] text-muted-foreground">{job.company}</p>
        <h2 className="mt-1 text-lg leading-snug font-semibold tracking-[-0.3px] text-foreground">
          {job.title}
        </h2>
      </div>
      <JobRail
        job={job}
        onStage={actions.onStage}
        onPriority={actions.onPriority}
        className="border-t-0 px-3 pt-1 pb-5 lg:w-full lg:overflow-visible lg:border-l-0"
      />
    </div>
  )
}
