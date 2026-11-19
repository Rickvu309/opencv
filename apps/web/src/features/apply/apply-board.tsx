import {
  useEffect,
  useReducer,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import {
  parseJobId,
  type JobId,
  type JobStage,
  type JobView,
} from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu"
import { Kbd } from "@workspace/ui/components/kbd"

import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@workspace/ui/components/kanban"
import { toast, toastWithUndo } from "@workspace/ui/components/sonner"
import { StageIcon } from "@workspace/ui/components/stage-icon"
import { cn } from "@workspace/ui/lib/utils"

import { undoActivity, useRunCommand } from "@/lib/contract-client.ts"
import { reportRejected } from "@/lib/command-failure.ts"
import { useShortcut } from "@/lib/use-shortcut.ts"

import { jobListKey, prefetchJob } from "./apply-api.ts"
import {
  allSettled,
  dropsReducer,
  noDrops,
  previewMove,
  refetchBoard,
  shownJobs,
  type Drops,
  type DropsAction,
} from "./apply-board-drops.ts"
import { isFocusKey, stepFocus } from "./apply-board-focus.ts"
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

type Drag = { id: string; over: JobStage | null; keyboard: boolean } | null

type DragAction =
  | { type: "started"; id: string; keyboard: boolean }
  | { type: "moved_over"; id: string; over: JobStage | null }
  | { type: "ended" }

function dragReducer(_drag: Drag, action: DragAction): Drag {
  switch (action.type) {
    case "started":
      return { id: action.id, over: null, keyboard: action.keyboard }
    case "moved_over":
      return {
        id: action.id,
        over: action.over ?? _drag?.over ?? null,
        keyboard: _drag?.keyboard ?? false,
      }
    case "ended":
      return null
  }
}

type StageMenu = { jobId: string; anchor: HTMLElement } | null

type StageMenuAction =
  { type: "opened"; jobId: string; anchor: HTMLElement } | { type: "closed" }

function stageMenuReducer(
  _menu: StageMenu,
  action: StageMenuAction
): StageMenu {
  switch (action.type) {
    case "opened":
      return { jobId: action.jobId, anchor: action.anchor }
    case "closed":
      return null
  }
}

type LastMove = { undo: () => void; toastId: string | number }

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
  onNewJob,
  onOpenJob,
  openJobId,
}: {
  jobs: JobView[]
  showClosed: boolean
  onShowClosed: (show: boolean) => void
  onNewJob: (stage: JobStage) => void
  onOpenJob: (jobId: JobId) => void
  openJobId: string | null
}) {
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
  const [justAdded, dispatchJustAdded] = useReducer(justAddedReducer, null)
  const [menu, dispatchMenu] = useReducer(stageMenuReducer, null)
  const boardRef = useRef<HTMLDivElement>(null)
  const refocus = useRef<string | null>(null)
  const lastMove = useRef<LastMove | null>(null)

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
  const settled = toCards(shown, stages)
  const data =
    drag?.over && !drag.keyboard
      ? previewMove(settled, drag.id, drag.over)
      : settled

  useEffect(() => {
    if (!justAdded) return
    if (!shown.some((job) => job.id === justAdded)) return
    dispatchJustAdded({ type: "cleared" })
  }, [justAdded, shown])

  useEffect(() => {
    const jobId = refocus.current
    if (!jobId) return
    refocus.current = null
    focusCard(jobId)
  })

  function cardElement(jobId: string) {
    return boardRef.current?.querySelector<HTMLElement>(
      `[data-card-id="${CSS.escape(jobId)}"]`
    )
  }

  function focusCard(jobId: string) {
    const element = cardElement(jobId)
    if (!element) return
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

  function openJob(jobId: string) {
    onOpenJob(parseJobId(jobId))
  }

  function undoLastMove() {
    const move = lastMove.current
    if (!move) return
    lastMove.current = null
    toast.dismiss(move.toastId)
    move.undo()
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

  function persist(jobId: string, stage: JobStage, announce: boolean) {
    const input = { jobId: parseJobId(jobId), stage }
    const move = async () => {
      const result = await run("job.move", input, { refresh: false })
      if ((stage === "closed" || announce) && result.activityId) {
        const activityId = result.activityId
        const undo = () => {
          if (lastMove.current?.undo === undo) lastMove.current = null
          sendDrops({ type: "undone", jobId })
          void undoActivity(queryClient, activityId).catch(
            reportRejected("undo the move")
          )
        }
        const toastId = toastWithUndo(`Moved to ${stageLabel(stage)}`, undo)
        lastMove.current = { undo, toastId }
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
    if (stage) moveJob(jobId, stage, false)
  }

  function moveJob(jobId: string, stage: JobStage, announce: boolean) {
    const before = settled.find((card) => card.id === jobId)
    if (!before || before.column === stage) return
    sendDrops({ type: "dropped", jobId, stage })
    queryClient.setQueryData<JobView[]>(jobListKey(), (current) => {
      if (!current) return current
      const moved = current.find((job) => job.id === jobId)
      if (!moved) return current
      return [...current.filter((job) => job.id !== jobId), { ...moved, stage }]
    })
    persist(jobId, stage, announce)
  }

  function onCardKey(event: ReactKeyboardEvent<HTMLDivElement>, card: Card) {
    if (drag || event.defaultPrevented) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key
    if (key === "Enter") {
      event.preventDefault()
      openJob(card.id)
      return
    }
    if (isFocusKey(key)) {
      event.preventDefault()
      const target = stepFocus(columnIdsOf(data), card.id, key)
      if (!target || target === card.id) return
      focusCard(target)
      if (openJobId) openJob(target)
      return
    }
    const letter = key.toLowerCase()
    if (letter === "s") {
      event.preventDefault()
      dispatchMenu({
        type: "opened",
        jobId: card.id,
        anchor: event.currentTarget,
      })
      return
    }
    if (letter === "c") {
      event.preventDefault()
      onNewJob(card.column as JobStage)
    }
  }

  function columnIdsOf(cards: readonly Card[]) {
    return stages.map((stage) =>
      cards.filter((item) => item.column === stage).map((item) => item.id)
    )
  }

  function chooseStage(stage: JobStage) {
    if (!menu) return
    refocus.current = menu.jobId
    dispatchMenu({ type: "closed" })
    moveJob(menu.jobId, stage, true)
  }

  useShortcut({
    key: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
    enabled: !openJobId && !menu,
    prevent: false,
    onPress: (event) => {
      if (document.activeElement && document.activeElement !== document.body) {
        return
      }
      if (!isFocusKey(event.key)) return
      const first = stepFocus(columnIdsOf(data), null, event.key)
      if (!first) return
      event.preventDefault()
      focusCard(first)
    },
  })

  useShortcut({ key: "z", enabled: !menu, onPress: undoLastMove })

  const closedCount = shown.filter((job) => job.stage === "closed").length

  return (
    <div
      ref={boardRef}
      data-slot="apply-board"
      className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto bg-background p-3"
    >
      <KanbanProvider
        columns={columns}
        data={data}
        onDragStart={(event) => {
          lastOver.current = null
          dispatchDrag({
            type: "started",
            id: String(event.active.id),
            keyboard: event.activatorEvent instanceof KeyboardEvent,
          })
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
              className="group/lane min-h-0 w-[244px] min-w-[244px] gap-2 rounded-[6px] border-0 bg-secondary/50 px-2 pt-1 pb-2 ring-0"
            >
              <KanbanHeader className="p-0 font-normal">
                <BoardLane
                  name={column.name}
                  stage={stage}
                  count={data.filter((card) => card.column === stage).length}
                  onAdd={() => onNewJob(stage)}
                />
              </KanbanHeader>
              <KanbanCards
                id={column.id}
                className="min-h-0 flex-initial gap-2 p-0"
              >
                {(item: Card) => {
                  const isNew = item.id === justAdded
                  const isOpen = item.id === openJobId
                  return (
                    <KanbanCard
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      aria-label={item.name}
                      aria-current={isOpen ? "true" : undefined}
                      data-card-id={item.id}
                      data-new={isNew ? "true" : undefined}
                      wrapperClassName="rounded-[4px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chart-1/60 data-[new=true]:motion-appear"
                      className={cn(
                        "gap-0 rounded-[4px] border border-foreground/6 p-3 shadow-none ring-0 transition-colors hover:border-foreground/12 data-lifted:shadow-[0_2px_4px_rgb(0_0_0/0.06),0_16px_32px_rgb(0_0_0/0.12)] [&.opacity-30]:opacity-35",
                        isOpen &&
                          "border-foreground/14 bg-accent/50 hover:border-foreground/18"
                      )}
                      onClick={() => openJob(item.id)}
                      onPointerDown={() =>
                        prefetchJob(queryClient, parseJobId(item.id))
                      }
                      onFocus={() =>
                        prefetchJob(queryClient, parseJobId(item.id))
                      }
                      onKeyDown={(event) => onCardKey(event, item)}
                    >
                      <JobCard job={item.job} />
                    </KanbanCard>
                  )
                }}
              </KanbanCards>
              {drag?.keyboard &&
              drag.over === stage &&
              settled.find((card) => card.id === drag.id)?.column !== stage ? (
                <DropLine />
              ) : null}
              {drag ? null : (
                <LaneAdd name={column.name} onAdd={() => onNewJob(stage)} />
              )}
            </KanbanBoard>
          )
        }}
      </KanbanProvider>
      <HiddenColumns
        count={closedCount}
        showClosed={showClosed}
        onShowClosed={onShowClosed}
      />
      <StageMenu
        menu={menu}
        current={
          menu
            ? (settled.find((card) => card.id === menu.jobId)?.column ?? null)
            : null
        }
        onChoose={chooseStage}
        onClose={() => {
          if (menu) refocus.current = menu.jobId
          dispatchMenu({ type: "closed" })
        }}
      />
    </div>
  )
}

function StageMenu({
  menu,
  current,
  onChoose,
  onClose,
}: {
  menu: StageMenu
  current: string | null
  onChoose: (stage: JobStage) => void
  onClose: () => void
}) {
  return (
    <DropdownMenu
      open={menu !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DropdownMenuContent
        anchor={menu?.anchor ?? null}
        aria-label="Move to stage"
        data-slot="stage-menu"
        className="min-w-48"
        onKeyDown={(event) => {
          const stage = ALL_STAGES[Number(event.key) - 1]
          if (!stage || stage === current) return
          event.preventDefault()
          onChoose(stage)
        }}
      >
        {ALL_STAGES.map((stage, index) => (
          <DropdownMenuItem
            key={stage}
            disabled={stage === current}
            onClick={() => onChoose(stage)}
          >
            <StageIcon stage={stage} decorative />
            {stageLabel(stage)}
            <Kbd className="ml-auto">{index + 1}</Kbd>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LaneAdd({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <Button
      size="touch"
      type="button"
      variant="ghost"
      aria-hidden
      tabIndex={-1}
      data-slot="lane-add"
      title={`New job in ${name}`}
      className="w-full shrink-0 rounded-[4px] border border-foreground/6 bg-card text-muted-foreground opacity-0 group-hover/lane:opacity-100 hover:bg-card hover:text-foreground max-md:hidden"
      onClick={onAdd}
    >
      <Plus />
    </Button>
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
          <StageIcon stage="closed" decorative />
          <span>Closed</span>
          <span className={FAINT_TEXT.card}>{count}</span>
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}
