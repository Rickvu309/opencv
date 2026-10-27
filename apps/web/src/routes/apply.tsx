import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import type { JobView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { PageHeader } from "@workspace/ui/components/page-header"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

import { ApplyBoard } from "@/features/apply/apply-board.tsx"
import { ApplyCalendar } from "@/features/apply/apply-calendar.tsx"
import { ApplyList } from "@/features/apply/apply-list.tsx"
import { jobListKey, listJobs } from "@/features/apply/apply-api.ts"
import { NewJobDialog } from "@/features/apply/apply-new-job-dialog.tsx"
import type { ApplySpan, ApplyView } from "@/features/apply/apply-search.ts"

function matches(job: JobView, company: string, location: string) {
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
  const [company, setCompany] = useState("")
  const [location, setLocation] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const filtering = company.trim() !== "" || location.trim() !== ""
  const filtered = (jobs.data ?? []).filter((job) =>
    matches(job, company, location)
  )
  const empty =
    !jobs.isLoading &&
    !jobs.isError &&
    (jobs.data?.length ?? 0) === 0 &&
    !filtering
  const noMatch =
    !jobs.isLoading && !jobs.isError && filtering && filtered.length === 0
  const headerGlow = !dialogOpen && !empty

  function setView(next: ApplyView) {
    void navigate({
      to: "/app/apply",
      search:
        next === "board"
          ? {}
          : next === "list"
            ? { view: "list" }
            : { view: "calendar", span },
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Apply">
        <Button
          type="button"
          variant={headerGlow ? "glow" : "ghost"}
          onClick={() => setDialogOpen(true)}
        >
          New job
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2 px-5 py-2">
        <Button
          type="button"
          variant="ghost"
          aria-pressed={view === "board"}
          onClick={() => setView("board")}
        >
          Board
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
        >
          List
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={view === "calendar"}
          onClick={() => setView("calendar")}
        >
          Calendar
        </Button>
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="ghost" />}>
            Filter
          </PopoverTrigger>
          <PopoverContent className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-company">Company</Label>
              <Input
                id="filter-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-location">Location</Label>
              <Input
                id="filter-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
          </PopoverContent>
        </Popover>
        {!empty ? (
          <Button
            type="button"
            variant="ghost"
            aria-expanded={showClosed}
            onClick={() => setShowClosed((open) => !open)}
          >
            Hidden columns
          </Button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-5 pb-4">
        {jobs.isLoading ? <p role="status">Loading jobs</p> : null}
        {jobs.isError ? (
          <div>
            <p>Could not load jobs. Refresh the page.</p>
            <Button type="button" onClick={() => void jobs.refetch()}>
              Refresh
            </Button>
          </div>
        ) : null}
        {empty ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                <h2>Track your first job</h2>
              </EmptyTitle>
              <EmptyDescription>
                Add the jobs you're applying to.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                variant={dialogOpen ? "ghost" : "glow"}
                onClick={() => setDialogOpen(true)}
              >
                Add job
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}
        {noMatch ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                No jobs match these filters. Try removing one.
              </EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCompany("")
                  setLocation("")
                }}
              >
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}
        {!jobs.isLoading &&
        !jobs.isError &&
        !empty &&
        !noMatch &&
        view === "board" ? (
          <ApplyBoard jobs={filtered} showClosed={showClosed} />
        ) : null}
        {!jobs.isLoading &&
        !jobs.isError &&
        !empty &&
        !noMatch &&
        view === "list" ? (
          <ApplyList jobs={filtered} showClosed={showClosed} />
        ) : null}
        {!jobs.isLoading &&
        !jobs.isError &&
        !empty &&
        !noMatch &&
        view === "calendar" ? (
          <ApplyCalendar
            span={span}
            company={company}
            location={location}
            showClosed={showClosed}
            onSpan={(next) =>
              void navigate({
                to: "/app/apply",
                search: { view: "calendar", span: next },
              })
            }
          />
        ) : null}
      </div>
      <NewJobDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
