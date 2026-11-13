import { useEffect, useReducer, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { parseJobId, type JobStage, type JobView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

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

import { undoActivity, useRunCommand } from "@/lib/contract-client.ts"
import { reportRejected } from "@/lib/command-failure.ts"

import { jobListKey } from "./apply-api.ts"
import {
  allSettled,
  dropsReducer,
  noDrops,
  refetchBoard,
  shownJobs,
  type Drops,
  type DropsAction,
} from "./apply-board-drops.ts"
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

type JustAddedAction = { type: "created"; id: string } | { type: "cleared" }

function justAddedReducer(
  _current: string | null,
  action: JustAddedAction
): string | null {
  switch (action.type) {
    case "created":
      return action.id
    case "cleared":
      return null
  }
}

type Drag = { id: string; over: JobStage | null } | null

type DragAction =
  | { type: "started"; id: string }
  | { type: "moved_over"; id: string; over: JobStage | null }
  | { type: "ended" }

function dragReducer(_drag: Drag, action: DragAction): Drag {
  switch (action.type) {
    case "started":
      return { id: action.id, over: null }
    case "moved_over":
      return { id: action.id, over: action.over }
    case "ended":
      return null
  }
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
  justAddedJobId,
}: {
  jobs: JobView[]
  showClosed: boolean
  onShowClosed: (show: boolean) => void
  justAddedJobId?: string | null
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const run = useRunCommand()
  const tails = useRef(new Map<string, Promise<unknown>>())
  const dropsRef = useRef<Drops>(noDrops)
  const [drops, dispatchDrops] = useReducer(dropsReducer, noDrops)
  function sendDrops(action: DropsAction) {
    dropsRef.current = dropsReducer(dropsRef.current, action)
    dispatchDrops(action)
  }
  const lastOver = useRef<JobStage | null>(null)
  const [drag, dispatchDrag] = useReducer(dragReducer, null)
  const renderedRef = useRef<string | null>(null)
  const [justAdded, dispatchJustAdded] = useReducer(
    justAddedReducer,
    justAddedJobId ?? null
  )

  useEffect(() => {
    if (!justAddedJobId) return
    dispatchJustAdded({ type: "created", id: justAddedJobId })
  }, [justAddedJobId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onCreated = (event: Event) => {
      const custom = event as CustomEvent<{ id: string }>
      if (custom.detail?.id) {
        dispatchJustAdded({ type: "created", id: custom.detail.id })
      }
    }
    window.addEventListener("opencv:job-created", onCreated)
    return () => {
      window.removeEventListener("opencv:job-created", onCreated)
    }
  }, [])

  const stages = showClosed ? ALL_STAGES : BOARD_STAGES
  const columns = stages.map((stage) => ({
    id: stage,
    name: stageLabel(stage),
  }))
  const shown = shownJobs(jobs, drops)
  const data = toCards(shown, stages)

  useEffect(() => {
    if (!justAdded) return
    if (!shown.some((job) => job.id === justAdded)) return
    if (renderedRef.current !== justAdded) {
      renderedRef.current = justAdded
      const timer = setTimeout(() => {
        dispatchJustAdded({ type: "cleared" })
        renderedRef.current = null
      }, 300)
      return () => clearTimeout(timer)
    }
    dispatchJustAdded({ type: "cleared" })
    renderedRef.current = null
  }, [justAdded, shown])

  function openJob(jobId: string) {
    void navigate({
      to: "/apply/$jobId",
      params: { jobId },
    })
  }

  function refreshBoard() {
    void refetchBoard(queryClient).finally(() => {
      if (!allSettled(dropsRef.current)) return
      if (queryClient.isFetching({ queryKey: jobListKey() }) > 0) {
        refreshBoard()
        return
      }
      sendDrops({ type: "landed" })
    })
  }

  function persist(jobId: string, stage: JobStage) {
    const input = { jobId: parseJobId(jobId), stage }
    const move = async () => {
      const result = await run("job.move", input, { refresh: false })
      if (stage === "closed" && result.activityId) {
        const activityId = result.activityId
        toastWithUndo("Moved to Closed", () => {
          sendDrops({ type: "undone", jobId })
          void undoActivity(queryClient, activityId).catch(
            reportRejected("undo the move")
          )
        })
      }
    }
    const prev = tails.current.get(jobId) ?? Promise.resolve()
    const next = prev
      .then(move)
      .catch(() => undefined)
      .finally(() => {
        sendDrops({ type: "move_settled", jobId })
        if (allSettled(dropsRef.current)) refreshBoard()
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

  function onDragEnd(
    event: {
      active: { id: string | number }
      over: { id: string | number } | null
    },
    hovered: JobStage | null
  ) {
    const jobId = String(event.active.id)
    const stage = event.over ? stageOf(String(event.over.id)) : hovered
    const before = data.find((card) => card.id === jobId)
    if (!before || !stage || before.column === stage) return
    sendDrops({ type: "dropped", jobId, stage })
    queryClient.setQueryData<JobView[]>(jobListKey(), (current) => {
      if (!current) return current
      return current.map((job) => (job.id === jobId ? { ...job, stage } : job))
    })
    persist(jobId, stage)
  }

  const closedCount = shown.filter((job) => job.stage === "closed").length
  const activeStage = drag ? stageOf(drag.id) : null

  return (
    <div
      data-slot="apply-board"
      className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto bg-card p-3"
    >
      <KanbanProvider
        columns={columns}
        data={data}
        onDragStart={(event) => {
          lastOver.current = null
          dispatchDrag({ type: "started", id: String(event.active.id) })
        }}
        onDragOver={(event) => {
          const over = event.over ? stageOf(String(event.over.id)) : null
          if (over) lastOver.current = over
          dispatchDrag({
            type: "moved_over",
            id: String(event.active.id),
            over,
          })
        }}
        onDragEnd={(event) => {
          dispatchDrag({ type: "ended" })
          onDragEnd(event, lastOver.current)
          lastOver.current = null
        }}
        onDragCancel={() => {
          lastOver.current = null
          dispatchDrag({ type: "ended" })
        }}
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
                className="min-h-0 flex-initial gap-2 p-0"
              >
                {(item: Card) => {
                  const isNew =
                    item.id === justAdded && renderedRef.current !== justAdded
                  return (
                    <KanbanCard
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      aria-label={item.name}
                      data-card-id={item.id}
                      data-new={isNew ? "true" : undefined}
                      wrapperClassName="data-[new=true]:motion-appear"
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
                  )
                }}
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
  return (
    <Collapsible
      defaultOpen
      data-slot="hidden-columns"
      className="flex w-32 shrink-0 flex-col gap-1.5 pt-1.5"
    >
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-11 justify-start gap-1.5 rounded-[6px] px-1 text-xs font-medium text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-muted md:h-6"
          />
        }
      >
        <CollapsibleIndicator className="size-3" />
        Hidden columns
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col">
        <Button
          type="button"
          variant="ghost"
          aria-pressed={showClosed}
          aria-label="Closed"
          className={cn(
            "h-11 w-full justify-start gap-2 rounded-md border border-border px-2.5 text-[13px] font-normal md:h-[34px]",
            showClosed ? "bg-accent hover:bg-accent" : "bg-card"
          )}
          onClick={() => onShowClosed(!showClosed)}
        >
          <StageIcon stage="closed" />
          <span>Closed</span>
          <span className={FAINT_TEXT.card}>{count}</span>
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}
