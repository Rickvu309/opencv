import { useReducer } from "react"
import { useShortcut } from "@/lib/use-shortcut.ts"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  commands,
  ERROR_CODES,
  type JobId,
  type JobStage,
  type JobPriority,
} from "@workspace/domain"
import { useNavigate } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { toastWithUndo } from "@workspace/ui/components/sonner"

import { reportRejected } from "@/lib/command-failure.ts"

import { authClient } from "@/lib/auth-client.ts"
import { ApiError } from "@/lib/api-error.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import {
  activityKey,
  catalogClient,
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

const JOB_NOTICE =
  "flex max-w-lg flex-col items-start gap-3 p-6 text-sm text-foreground"

type DetailState = { deleteOpen: boolean; railOpen: boolean }

type DetailAction =
  | { type: "delete_requested" }
  | { type: "delete_dismissed" }
  | { type: "rail_toggled" }

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case "delete_requested":
      return { ...state, deleteOpen: true }
    case "delete_dismissed":
      return { ...state, deleteOpen: false }
    case "rail_toggled":
      return { ...state, railOpen: !state.railOpen }
  }
}

const SKIP_REFRESH_FOR_DELETED_JOB = { refresh: false } as const

export function ApplyJobDetail({ jobId: id }: { jobId: JobId }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const run = useRunCommand()
  const { data: session } = authClient.useSession()
  const [{ deleteOpen, railOpen }, dispatch] = useReducer(detailReducer, {
    deleteOpen: false,
    railOpen: true,
  })
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

  useShortcut({
    key: ["Delete", "Backspace"],
    onPress: () => dispatch({ type: "delete_requested" }),
  })

  const ordered = [...(jobs.data ?? [])].sort(compareJobs)
  const index = ordered.findIndex((job) => job.id === id)
  const previous = index > 0 ? ordered[index - 1] : undefined
  const next = index >= 0 ? ordered[index + 1] : undefined
  const job = detail.data

  async function changeStage(stage: JobStage) {
    const result = await run("job.move", { jobId: id, stage })
    if (stage === "closed" && result.activityId) {
      const activityId = result.activityId
      toastWithUndo("Moved to Closed", () => {
        void undoActivity(queryClient, activityId).catch(
          reportRejected("undo the move")
        )
      })
    }
  }

  if (detail.isLoading)
    return (
      <p role="status" className={JOB_NOTICE}>
        Loading job…
      </p>
    )
  if (
    detail.error instanceof ApiError &&
    detail.error.code === ERROR_CODES.NOT_FOUND
  ) {
    return (
      <div className={JOB_NOTICE}>
        <p>Job not found.</p>
        <Button
          className="h-11 md:h-8"
          type="button"
          onClick={() => void navigate({ to: SURFACE_PATHS.apply })}
        >
          Back to Apply
        </Button>
      </div>
    )
  }
  if (detail.isError || !job) {
    return (
      <div className={JOB_NOTICE}>
        <p>Couldn't load this job.</p>
        <Button
          className="h-11 md:h-8"
          type="button"
          onClick={() => void detail.refetch()}
        >
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

  async function changePriority(priority: JobPriority) {
    const result = await catalogClient.run(queryClient, "job.setPriority", {
      jobId: id,
      priority,
    })
    if ("activityId" in result && result.activityId) {
      const activityId = result.activityId
      toastWithUndo(`Priority set to ${priority}`, () => {
        void undoActivity(queryClient, activityId).catch(
          reportRejected("undo the priority change")
        )
      })
    }
  }

  return (
    <div
      data-pen-surface="apply"
      className="relative flex h-full min-h-0 flex-col bg-card"
    >
      <JobHeader
        job={job}
        position={index + 1}
        total={ordered.length}
        onPrevious={open(previous)}
        onNext={open(next)}
        railOpen={railOpen}
        onToggleRail={() => dispatch({ type: "rail_toggled" })}
        onToggleStar={() =>
          void run("job.star", { jobId: id, starred: !job.starred }).catch(
            reportRejected("update the star")
          )
        }
        onDelete={() => dispatch({ type: "delete_requested" })}
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
          <JobRail
            job={job}
            onPriority={(priority) =>
              void changePriority(priority).catch(
                reportRejected("set priority")
              )
            }
            onStage={(stage) =>
              void changeStage(stage).catch(reportRejected("move this job"))
            }
          />
        ) : null}
      </div>
      <DeleteJobDialog
        open={deleteOpen}
        title={job.title}
        onOpenChange={(open) =>
          dispatch({ type: open ? "delete_requested" : "delete_dismissed" })
        }
        onDelete={() => {
          void run("job.delete", { jobId: id }, SKIP_REFRESH_FOR_DELETED_JOB)
            .then(() => {
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
              dispatch({ type: "delete_dismissed" })
            })
            .catch(reportRejected("delete this job"))
        }}
      />
    </div>
  )
}
