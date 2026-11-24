import { catalogClient } from "@/lib/contract-client.ts"
import { ownerIdFromRouteMatches } from "@/lib/owner-id.ts"
import { useReducer } from "react"
import { useShortcut } from "@/lib/use-shortcut.ts"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import type { JobId, JobStage, JobView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

import { ApplyBoard } from "@/features/apply/apply-board.tsx"
import {
  ApplyEmpty,
  ApplyNoResults,
} from "@/features/apply/apply-board-empty.tsx"
import { ApplyCalendar } from "@/features/apply/apply-calendar.tsx"
import { ApplyList } from "@/features/apply/apply-list.tsx"
import { jobListKey, listJobs } from "@/features/apply/apply-api.ts"
import { NewJobDialog } from "@/features/apply/apply-new-job-dialog.tsx"
import { ApplyNextUp } from "@/features/apply/apply-next-up-strip.tsx"
import { ApplyPeek } from "@/features/apply/apply-peek.tsx"
import { compareJobs } from "@/features/apply/apply-stages.ts"
import {
  activeFilterCount,
  validateApplySearch,
  type ApplyFilters,
  type ApplySearch,
  type ApplySpan,
  type ApplyView,
} from "@/features/apply/apply-search.ts"
import {
  ActiveFilters,
  ApplyHeader,
  ApplyToolbar,
} from "@/features/apply/apply-toolbar.tsx"

type ApplyState = {
  dialogOpen: boolean
  dialogStage: JobStage
  showClosed: boolean
}

type ApplyAction =
  | { type: "dialog_opened"; stage: JobStage }
  | { type: "dialog_toggled"; open: boolean }
  | { type: "closed_toggled"; show: boolean }

const initialApplyState: ApplyState = {
  dialogOpen: false,
  dialogStage: "saved",
  showClosed: false,
}

function applyReducer(state: ApplyState, action: ApplyAction): ApplyState {
  switch (action.type) {
    case "dialog_opened":
      return { ...state, dialogOpen: true, dialogStage: action.stage }
    case "dialog_toggled":
      return { ...state, dialogOpen: action.open }
    case "closed_toggled":
      return { ...state, showClosed: action.show }
  }
}

function matches(job: JobView, { company, location }: ApplyFilters) {
  const companyNeedle = company.trim().toLowerCase()
  const locationNeedle = location.trim().toLowerCase()
  if (companyNeedle && !job.company.toLowerCase().includes(companyNeedle)) {
    return false
  }
  if (
    locationNeedle &&
    !(job.location ?? "").toLowerCase().includes(locationNeedle)
  ) {
    return false
  }
  return true
}

function applySearch(
  filters: ApplyFilters,
  view: ApplyView,
  span: ApplySpan,
  job?: string
): ApplySearch {
  return {
    ...(view === "board" ? {} : { view }),
    ...(view === "calendar" ? { span } : {}),
    ...(filters.company ? { company: filters.company } : {}),
    ...(filters.location ? { location: filters.location } : {}),
    ...(job ? { job } : {}),
  }
}

function peekOrder(
  jobs: readonly JobView[],
  view: ApplyView,
  showClosed: boolean
): JobId[] {
  const hideClosed = view === "board" && !showClosed
  return jobs
    .filter((job) => !(hideClosed && job.stage === "closed"))
    .sort(compareJobs)
    .map((job) => job.id)
}

export function ApplyPage() {
  const ownerId = useRouterState({
    select: (state) => ownerIdFromRouteMatches(state.matches),
  })
  const counts = catalogClient.useRead(ownerId, "job.priorityCounts", {})
  const navigate = useNavigate()
  const routeSearch = useRouterState({
    select: (state) => state.location.search,
  })
  const search = validateApplySearch(routeSearch)
  const view = search.view ?? "board"
  const span = search.span ?? "month"
  const filters: ApplyFilters = {
    company: search.company ?? "",
    location: search.location ?? "",
  }
  const jobs = useQuery({
    queryKey: jobListKey(),
    queryFn: listJobs,
  })
  const [{ dialogOpen, dialogStage, showClosed }, dispatch] = useReducer(
    applyReducer,
    initialApplyState
  )
  const filtering = activeFilterCount(filters) > 0
  const filtered = (jobs.data ?? []).filter((job) => matches(job, filters))
  const empty =
    !jobs.isLoading &&
    !jobs.isError &&
    (jobs.data?.length ?? 0) === 0 &&
    !filtering
  const noMatch =
    !jobs.isLoading && !jobs.isError && filtering && filtered.length === 0
  const ready = !jobs.isLoading && !jobs.isError && !empty && !noMatch
  const openJobId = search.job ?? null

  useShortcut({
    key: "n",
    enabled: !dialogOpen,
    onPress: () => dispatch({ type: "dialog_opened", stage: "saved" }),
  })

  function setFilters(next: ApplyFilters) {
    void navigate({
      to: "/apply",
      replace: true,
      resetScroll: false,
      search: applySearch(next, view, span, search.job),
    })
  }

  function setView(next: ApplyView) {
    void navigate({
      to: "/apply",
      search: applySearch(filters, next, span, search.job),
    })
  }

  function openJob(jobId: JobId) {
    void navigate({
      to: "/apply",
      replace: Boolean(search.job),
      resetScroll: false,
      search: applySearch(filters, view, span, jobId),
    })
  }

  function closeJob() {
    void navigate({
      to: "/apply",
      replace: true,
      resetScroll: false,
      search: applySearch(filters, view, span),
    })
  }

  return (
    <div
      data-surface="apply"
      className="relative flex h-full min-h-0 flex-col bg-background"
    >
      <ApplyHeader
        onNewJob={() => dispatch({ type: "dialog_opened", stage: "saved" })}
      />
      <ApplyToolbar
        view={view}
        onView={setView}
        filters={filters}
        onFilters={setFilters}
        priorityCounts={counts.data}
        priorityCountsFailed={Boolean(ownerId && counts.isError)}
        showFilter={!empty}
        nextUp={
          ready && view !== "calendar" ? (
            <ApplyNextUp jobs={filtered} onOpen={openJob} />
          ) : null
        }
      />
      <ActiveFilters filters={filters} onFilters={setFilters} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          key={view}
          className="flex min-h-0 flex-1 flex-col overflow-auto motion-fade-in"
        >
          {jobs.isLoading ? (
            <p role="status" className="px-5 text-sm">
              Loading jobs
            </p>
          ) : null}
          {jobs.isError ? (
            <div className="px-5">
              <p>Couldn't load jobs.</p>
              <Button
                size="touch"
                type="button"
                onClick={() => void jobs.refetch()}
              >
                Refresh
              </Button>
            </div>
          ) : null}
          {empty ? (
            <ApplyEmpty
              dialogOpen={dialogOpen}
              onAdd={() => dispatch({ type: "dialog_opened", stage: "saved" })}
            />
          ) : null}
          {noMatch ? (
            <ApplyNoResults
              onClear={() => setFilters({ company: "", location: "" })}
            />
          ) : null}
          {ready && view === "board" ? (
            <ApplyBoard
              jobs={filtered}
              showClosed={showClosed}
              onShowClosed={(show) =>
                dispatch({ type: "closed_toggled", show })
              }
              onNewJob={(stage) => dispatch({ type: "dialog_opened", stage })}
              onOpenJob={openJob}
              openJobId={openJobId}
            />
          ) : null}
          {ready && view === "list" ? (
            <ApplyList
              jobs={filtered}
              showClosed
              onOpenJob={openJob}
              openJobId={openJobId}
            />
          ) : null}
          {ready && view === "calendar" ? (
            <ApplyCalendar
              span={span}
              company={filters.company}
              location={filters.location}
              showClosed={showClosed}
              onOpenJob={openJob}
              onSpan={(next) =>
                void navigate({
                  to: "/apply",
                  search: applySearch(filters, "calendar", next, search.job),
                })
              }
            />
          ) : null}
        </div>
        {openJobId ? (
          <ApplyPeek
            jobId={openJobId}
            order={peekOrder(filtered, view, showClosed)}
            onOpen={openJob}
            onClose={closeJob}
          />
        ) : null}
      </div>
      <NewJobDialog
        key={dialogStage}
        stage={dialogStage}
        open={dialogOpen}
        onOpenChange={(open) => dispatch({ type: "dialog_toggled", open })}
      />
    </div>
  )
}
