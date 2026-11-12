import { catalogClient } from "@/lib/contract-client.ts"
import { useReducer } from "react"
import { useShortcut } from "@/lib/use-shortcut.ts"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import type { JobView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

import { ApplyBoard } from "@/features/apply/apply-board.tsx"
import {
  ApplyEmpty,
  ApplyNoResults,
} from "@/features/apply/apply-board-empty.tsx"
import { ApplyCalendar } from "@/features/apply/apply-calendar.tsx"
import { ApplyList } from "@/features/apply/apply-list.tsx"
import {
  jobListKey,
  listJobs,
  ownerIdFromRouteMatches,
} from "@/features/apply/apply-api.ts"
import { NewJobDialog } from "@/features/apply/apply-new-job-dialog.tsx"
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
  showClosed: boolean
}

type ApplyAction =
  | { type: "dialog_opened" }
  | { type: "dialog_toggled"; open: boolean }
  | { type: "closed_toggled"; show: boolean }

const initialApplyState: ApplyState = {
  dialogOpen: false,
  showClosed: false,
}

function applyReducer(state: ApplyState, action: ApplyAction): ApplyState {
  switch (action.type) {
    case "dialog_opened":
      return { ...state, dialogOpen: true }
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
  span: ApplySpan
): ApplySearch {
  return {
    ...(view === "board" ? {} : { view }),
    ...(view === "calendar" ? { span } : {}),
    ...(filters.company ? { company: filters.company } : {}),
    ...(filters.location ? { location: filters.location } : {}),
  }
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
  const [{ dialogOpen, showClosed }, dispatch] = useReducer(
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

  useShortcut({
    key: "n",
    enabled: !dialogOpen,
    onPress: () => dispatch({ type: "dialog_opened" }),
  })

  function setFilters(next: ApplyFilters) {
    void navigate({
      to: "/apply",
      replace: true,
      resetScroll: false,
      search: applySearch(next, view, span),
    })
  }

  function setView(next: ApplyView) {
    void navigate({
      to: "/apply",
      search: applySearch(filters, next, span),
    })
  }

  return (
    <div
      data-pen-surface="apply"
      className="flex h-full min-h-0 flex-col bg-card"
    >
      <ApplyHeader onNewJob={() => dispatch({ type: "dialog_opened" })} />
      <ApplyToolbar
        view={view}
        onView={setView}
        filters={filters}
        onFilters={setFilters}
      >
        <div
          aria-label="Jobs by priority"
          className="order-last flex basis-full gap-4 pb-2 text-sm text-muted-foreground md:order-none md:basis-auto md:pb-0 md:pl-3"
        >
          {counts.data?.map(({ priority, count }) => (
            <span key={priority} className="capitalize">
              {priority} <span className="tabular-nums">{count}</span>
            </span>
          ))}
          {ownerId && counts.isError ? (
            <span>Could not load priority counts.</span>
          ) : null}
        </div>
      </ApplyToolbar>
      <ActiveFilters filters={filters} onFilters={setFilters} />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {jobs.isLoading ? (
          <p role="status" className="px-5 text-sm">
            Loading jobs
          </p>
        ) : null}
        {jobs.isError ? (
          <div className="px-5">
            <p>Could not load jobs. Refresh the page.</p>
            <Button type="button" onClick={() => void jobs.refetch()}>
              Refresh
            </Button>
          </div>
        ) : null}
        {empty ? (
          <ApplyEmpty
            dialogOpen={dialogOpen}
            onAdd={() => dispatch({ type: "dialog_opened" })}
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
            onShowClosed={(show) => dispatch({ type: "closed_toggled", show })}
          />
        ) : null}
        {ready && view === "list" ? (
          <ApplyList jobs={filtered} showClosed />
        ) : null}
        {ready && view === "calendar" ? (
          <ApplyCalendar
            span={span}
            company={filters.company}
            location={filters.location}
            showClosed={showClosed}
            onSpan={(next) =>
              void navigate({
                to: "/apply",
                search: applySearch(filters, "calendar", next),
              })
            }
          />
        ) : null}
      </div>
      <NewJobDialog
        open={dialogOpen}
        onOpenChange={(open) => dispatch({ type: "dialog_toggled", open })}
      />
    </div>
  )
}
