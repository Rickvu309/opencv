import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { commands, type JobId, type JobStage } from "@workspace/domain"
import { useNavigate } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { toastWithUndo } from "@workspace/ui/components/sonner"

import { authClient } from "@/lib/auth-client.ts"
import { recordFirstCafeItem } from "@/features/home/first-cafe-checklist.ts"
import {
  activityKey,
  refreshQueries,
  useRunCommand,
  undoActivity,
} from "@/lib/contract-client.ts"

import {
  getJob,
  jobGetKey,
  jobListKey,
  listActivity,
  listJobs,
} from "./apply-api.ts"
import { JobDocument } from "./apply-detail-document.tsx"
import { DeleteJobDialog } from "./apply-job-delete-dialog.tsx"
import { JobHeader } from "./apply-job-header.tsx"
import { JobRail } from "./apply-job-rail.tsx"
import { compareJobs } from "./apply-stages.ts"

function fieldTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
}

export function ApplyJobDetail({ jobId: id }: { jobId: JobId }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const run = useRunCommand()
  const { data: session } = authClient.useSession()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  const detail = useQuery({
    queryKey: jobGetKey(id),
    queryFn: () => getJob(id),
  })
  const jobs = useQuery({
    queryKey: jobListKey(),
    queryFn: listJobs,
  })
  const activity = useQuery({
    queryKey: activityKey("job", id),
    queryFn: () => listActivity(id),
  })

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      if (fieldTarget(event.target)) return
      event.preventDefault()
      setDeleteOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const ordered = [...(jobs.data ?? [])].sort(compareJobs)
  const index = ordered.findIndex((job) => job.id === id)
  const previous = index > 0 ? ordered[index - 1] : undefined
  const next = index >= 0 ? ordered[index + 1] : undefined
  const job = detail.data

  function noteCafe() {
    const userId = session?.user.id
    if (userId) recordFirstCafeItem(userId, "apply")
  }

  async function changeStage(stage: JobStage) {
    const result = await run("job.move", { jobId: id, stage })
    noteCafe()
    if (stage === "closed" && result.activityId) {
      const activityId = result.activityId
      toastWithUndo("Moved to Closed", () => {
        void undoActivity(queryClient, activityId)
      })
    }
  }

  if (detail.isLoading) return <p role="status">Loading jobs</p>
  if (detail.isError || !job) {
    return (
      <div>
        <p>Could not load jobs. Refresh the page.</p>
        <Button type="button" onClick={() => void detail.refetch()}>
          Refresh
        </Button>
      </div>
    )
  }

  const rows = (activity.data ?? []).filter((row) => !row.undoneAt)

  function open(target: { id: JobId } | undefined) {
    return target
      ? () =>
          void navigate({
            to: "/apply/$jobId",
            params: { jobId: target.id },
          })
      : null
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <JobHeader
        job={job}
        position={index + 1}
        total={ordered.length}
        onPrevious={open(previous)}
        onNext={open(next)}
        railOpen={railOpen}
        onToggleRail={() => setRailOpen((current) => !current)}
        onToggleStar={() =>
          void run("job.star", { jobId: id, starred: !job.starred })
        }
        onDelete={() => setDeleteOpen(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="min-w-0 flex-1 px-6 pt-10 pb-6 lg:overflow-y-auto lg:px-12">
          <JobDocument
            job={job}
            rows={rows}
            author={session?.user.name ?? "You"}
          />
        </div>
        {railOpen ? (
          <JobRail job={job} onStage={(stage) => void changeStage(stage)} />
        ) : null}
      </div>
      <DeleteJobDialog
        open={deleteOpen}
        title={job.title}
        onOpenChange={setDeleteOpen}
        onDelete={() => {
          // Navigate before refreshing, so the deleted job's own read is
          // not refetched into an error on screen.
          void run("job.delete", { jobId: id }, { refresh: false }).then(() => {
            const destination = next ?? previous
            if (destination) {
              void navigate({
                to: "/apply/$jobId",
                params: { jobId: destination.id },
              })
            } else {
              void navigate({ to: "/apply" })
            }
            queryClient.removeQueries({ queryKey: jobGetKey(id) })
            void refreshQueries(
              queryClient,
              commands["job.delete"].invalidates({ jobId: id })
            )
            setDeleteOpen(false)
          })
        }}
      />
    </div>
  )
}
