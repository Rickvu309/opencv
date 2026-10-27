import { useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { parseJobId, type JobStage, type JobView } from "@workspace/domain"

import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@workspace/ui/components/kanban"
import { toastWithUndo } from "@workspace/ui/components/sonner"

import { useRunCommand } from "@/lib/contract-client.ts"
import { authClient } from "@/lib/auth-client.ts"
import { recordFirstCafeItem } from "@/features/home/first-cafe-checklist.ts"

import { jobListKey, undoActivity } from "./apply-api.ts"
import { BoardLane, JobCard } from "./apply-parts.tsx"
import {
  ALL_STAGES,
  BOARD_STAGES,
  cardName,
  listPhrase,
  stageLabel,
} from "./apply-stages.ts"

type Card = {
  id: string
  name: string
  column: string
  job: JobView
}

function toCards(jobs: JobView[], stages: readonly JobStage[]): Card[] {
  return jobs
    .filter((job) => stages.includes(job.stage))
    .map((job) => ({
      id: job.id,
      name: cardName(job),
      column: job.stage,
      job,
    }))
}

export function ApplyBoard({
  jobs,
  showClosed,
}: {
  jobs: JobView[]
  showClosed: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const run = useRunCommand()
  const { data: session } = authClient.useSession()
  const tails = useRef(new Map<string, Promise<unknown>>())
  const stages = showClosed ? ALL_STAGES : BOARD_STAGES
  const columns = stages.map((stage) => ({
    id: stage,
    name: stageLabel(stage),
  }))
  const data = toCards(jobs, stages)

  function openJob(jobId: string) {
    void navigate({
      to: "/app/apply/$jobId",
      params: { jobId },
    })
  }

  function persist(jobId: string, stage: JobStage) {
    const move = async () => {
      const result = await run("job.move", { jobId: parseJobId(jobId), stage })
      const userId = session?.user.id
      if (userId) recordFirstCafeItem(userId, "apply")
      if (stage === "closed" && result.activityId) {
        const activityId = result.activityId
        toastWithUndo("Moved to Closed", () => {
          void undoActivity(queryClient, activityId)
        })
      }
    }
    const prev = tails.current.get(jobId) ?? Promise.resolve()
    const next = prev.then(move).catch(() => {
      void queryClient.invalidateQueries({ queryKey: jobListKey() })
    })
    tails.current.set(jobId, next)
  }

  function stageOf(id: string): JobStage | null {
    if ((stages as readonly string[]).includes(id)) return id as JobStage
    const card = data.find((item) => item.id === id)
    if (!card || !(stages as readonly string[]).includes(card.column)) {
      return null
    }
    return card.column as JobStage
  }

  function onDragEnd(event: {
    active: { id: string | number }
    over: { id: string | number } | null
  }) {
    if (!event.over) return
    const jobId = String(event.active.id)
    const stage = stageOf(String(event.over.id))
    const before = data.find((card) => card.id === jobId)
    if (!before || !stage || before.column === stage) return
    queryClient.setQueryData<JobView[]>(jobListKey(), (current) => {
      if (!current) return current
      return current.map((job) => (job.id === jobId ? { ...job, stage } : job))
    })
    persist(jobId, stage)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-x-auto">
        <KanbanProvider
          columns={columns}
          data={data}
          onDragEnd={onDragEnd}
          className="h-full min-h-80 w-max auto-cols-[244px]"
        >
          {(column) => (
            <KanbanBoard
              key={column.id}
              id={column.id}
              role="region"
              aria-label={column.name}
              data-stage={column.id}
              style={{ width: 244, minWidth: 244 }}
            >
              <KanbanHeader>
                <BoardLane name={column.name} stage={column.id}>
                  {null}
                </BoardLane>
              </KanbanHeader>
              <KanbanCards id={column.id}>
                {(item: Card) => (
                  <KanbanCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    aria-label={item.name}
                    data-card-id={item.id}
                    onClick={() => openJob(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        openJob(item.id)
                      }
                    }}
                  >
                    <JobCard job={item.job} phrase={listPhrase(item.job)} />
                  </KanbanCard>
                )}
              </KanbanCards>
            </KanbanBoard>
          )}
        </KanbanProvider>
      </div>
    </div>
  )
}
