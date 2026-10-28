import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ChevronDown } from "lucide-react"
import { parseJobId, type JobStage, type JobView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@workspace/ui/components/kanban"
import { toastWithUndo } from "@workspace/ui/components/sonner"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { cn } from "@workspace/ui/lib/utils"

import {
  refreshQueries,
  undoActivity,
  useRunCommand,
} from "@/lib/contract-client.ts"
import { authClient } from "@/lib/auth-client.ts"
import { recordFirstCafeItem } from "@/features/home/first-cafe-checklist.ts"

import { jobListKey } from "./apply-api.ts"
import { BoardLane, JobCard } from "./apply-parts.tsx"
import {
  ALL_STAGES,
  BOARD_STAGES,
  cardName,
  stageLabel,
} from "./apply-stages.ts"
import { FAINT_TEXT } from "./apply-tone.ts"

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
  onShowClosed,
}: {
  jobs: JobView[]
  showClosed: boolean
  onShowClosed: (show: boolean) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const run = useRunCommand()
  const { data: session } = authClient.useSession()
  const tails = useRef(new Map<string, Promise<unknown>>())
  const pendingMoves = useRef(0)
  const [drag, setDrag] = useState<{
    id: string
    over: JobStage | null
  } | null>(null)
  const stages = showClosed ? ALL_STAGES : BOARD_STAGES
  const columns = stages.map((stage) => ({
    id: stage,
    name: stageLabel(stage),
  }))
  const data = toCards(jobs, stages)

  function openJob(jobId: string) {
    void navigate({
      to: "/apply/$jobId",
      params: { jobId },
    })
  }

  function persist(jobId: string, stage: JobStage) {
    const input = { jobId: parseJobId(jobId), stage }
    pendingMoves.current += 1
    const move = async () => {
      const result = await run("job.move", input, { refresh: false })
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
    // A refetch landing between two quick drags would snap a card back, so the
    // board refreshes once, after its last pending move settles.
    const next = prev
      .then(move)
      .catch(() => undefined)
      .finally(() => {
        pendingMoves.current -= 1
        if (pendingMoves.current === 0) {
          void refreshQueries(queryClient, [
            { query: "job.list" },
            { query: "job.get" },
            { query: "job.calendar" },
          ])
        }
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
    void (async () => {
      await queryClient.cancelQueries({ queryKey: jobListKey() })
      queryClient.setQueryData<JobView[]>(jobListKey(), (current) => {
        if (!current) return current
        return current.map((job) =>
          job.id === jobId ? { ...job, stage } : job
        )
      })
      persist(jobId, stage)
    })()
  }

  const closedCount = jobs.filter((job) => job.stage === "closed").length
  const activeStage = drag ? stageOf(drag.id) : null

  return (
    <div
      data-slot="apply-board"
      className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto bg-card p-3"
    >
      <KanbanProvider
        columns={columns}
        data={data}
        onDragStart={(event) =>
          setDrag({ id: String(event.active.id), over: null })
        }
        onDragOver={(event) =>
          setDrag({
            id: String(event.active.id),
            over: event.over ? stageOf(String(event.over.id)) : null,
          })
        }
        onDragEnd={(event) => {
          setDrag(null)
          onDragEnd(event)
        }}
        onDragCancel={() => setDrag(null)}
        className="h-full min-h-80 w-max auto-cols-[244px] gap-2.5"
      >
        {(column) => {
          const stage = column.id as JobStage
          return (
            <KanbanBoard
              key={column.id}
              id={column.id}
              role="region"
              aria-label={column.name}
              data-stage={column.id}
              className="min-h-0 w-[244px] min-w-[244px] gap-2 rounded-[6px] border-0 bg-background px-2 pt-1 pb-2 ring-0"
            >
              <KanbanHeader className="p-0 font-normal">
                <BoardLane
                  name={column.name}
                  stage={stage}
                  count={data.filter((card) => card.column === stage).length}
                />
              </KanbanHeader>
              <KanbanCards
                id={column.id}
                className="min-h-0 flex-none gap-2 p-0"
              >
                {(item: Card) => (
                  <KanbanCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    aria-label={item.name}
                    data-card-id={item.id}
                    className="gap-0 rounded-[10px] border border-foreground/6 p-3 shadow-none ring-0 not-in-data-[slot=kanban-card]:shadow-[0_2px_4px_rgb(0_0_0/0.06),0_16px_32px_rgb(0_0_0/0.12)] [&.opacity-30]:opacity-35"
                    onClick={() => openJob(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        openJob(item.id)
                      }
                    }}
                  >
                    <JobCard job={item.job} />
                  </KanbanCard>
                )}
              </KanbanCards>
              {drag?.over === stage && activeStage !== stage ? (
                <DropLine />
              ) : null}
            </KanbanBoard>
          )
        }}
      </KanbanProvider>
      <HiddenColumns
        count={closedCount}
        showClosed={showClosed}
        onShowClosed={onShowClosed}
      />
    </div>
  )
}

function DropLine() {
  return (
    <div data-slot="drop-line" aria-hidden className="relative h-2 shrink-0">
      <span className="absolute top-[3px] right-0 left-1.5 h-0.5 rounded-[1px] bg-chart-1" />
      <span className="absolute top-0 left-0 size-2 rounded-full border-2 border-chart-1 bg-card" />
    </div>
  )
}

function HiddenColumns({
  count,
  showClosed,
  onShowClosed,
}: {
  count: number
  showClosed: boolean
  onShowClosed: (show: boolean) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div
      data-slot="hidden-columns"
      className="flex w-32 shrink-0 flex-col gap-1.5 pt-1.5"
    >
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        className="h-6 justify-start gap-1.5 rounded-[6px] px-1 text-xs font-medium text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-muted"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown
          className={cn(
            "size-3 transition-transform duration-(--duration-micro) ease-(--ease-micro)",
            !open && "-rotate-90"
          )}
        />
        Hidden columns
      </Button>
      {open ? (
        <Button
          type="button"
          variant="ghost"
          aria-pressed={showClosed}
          aria-label="Closed"
          className={cn(
            "h-[34px] w-full justify-start gap-2 rounded-md border border-border px-2.5 text-[13px] font-normal",
            showClosed ? "bg-accent hover:bg-accent" : "bg-card"
          )}
          onClick={() => onShowClosed(!showClosed)}
        >
          <StageIcon stage="closed" />
          <span>Closed</span>
          <span className={FAINT_TEXT.card}>{count}</span>
        </Button>
      ) : null}
    </div>
  )
}
