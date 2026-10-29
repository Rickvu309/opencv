import { useEffect, useReducer } from "react"
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
import { jobListKey, listJobs } from "@/features/apply/apply-api.ts"
import { NewJobDialog } from "@/features/apply/apply-new-job-dialog.tsx"
import {
  activeFilterCount,
  type ApplyFilters,
  type ApplySpan,
  type ApplyView,
} from "@/features/apply/apply-search.ts"
import {
  ActiveFilters,
  ApplyHeader,
  ApplyToolbar,
} from "@/features/apply/apply-toolbar.tsx"

type ApplyState = {
  filters: ApplyFilters
  dialogOpen: boolean
  showClosed: boolean
}

type ApplyAction =
  | { type: "filters_changed"; filters: ApplyFilters }
  | { type: "filters_cleared" }
  | { type: "dialog_opened" }
  | { type: "dialog_toggled"; open: boolean }
  | { type: "closed_toggled"; show: boolean }

const initialApplyState: ApplyState = {
  filters: { company: "", location: "" },
  dialogOpen: false,
  showClosed: false,
}

function applyReducer(state: ApplyState, action: ApplyAction): ApplyState {
  switch (action.type) {
    case "filters_changed":
      return { ...state, filters: action.filters }
    case "filters_cleared":
      return { ...state, filters: initialApplyState.filters }
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

function typingIn(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

export function ApplyPage() {
  const navigate = useNavigate()
  const search = useRouterState({
    select: (state) =>
      state.location.search as { view?: ApplyView; span?: ApplySpan },
  })
  const view = search.view ?? "board"
  const span = search.span ?? "month"
  const jobs = useQuery({
    queryKey: jobListKey(),
    queryFn: listJobs,
  })
  const [{ filters, dialogOpen, showClosed }, dispatch] = useReducer(
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

  useEffect(() => {
    if (dialogOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "n" || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (typingIn(event.target)) return
      event.preventDefault()
      dispatch({ type: "dialog_opened" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dialogOpen])

  function setView(next: ApplyView) {
    void navigate({
      to: "/apply",
      search:
        next === "board"
          ? {}
          : next === "list"
            ? { view: "list" }
            : { view: "calendar", span },
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <ApplyHeader onNewJob={() => dispatch({ type: "dialog_opened" })} />
      <ApplyToolbar
        view={view}
        onView={setView}
        filters={filters}
        onFilters={(next) =>
          dispatch({ type: "filters_changed", filters: next })
        }
      />
      <ActiveFilters
        filters={filters}
        onFilters={(next) =>
          dispatch({ type: "filters_changed", filters: next })
        }
      />
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
            onClear={() => dispatch({ type: "filters_cleared" })}
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
                search: { view: "calendar", span: next },
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
