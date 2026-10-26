import { useState } from "react"
import { useNavigate } from "react-router"
import { Plus, ListFilter, SlidersHorizontal } from "lucide-react"
import { PageHeader, Toolbar } from "~components/shell"
import { Button, IconButton } from "~components/button"
import { JobRow, ListGroup } from "~components/apply"
import type { Stage } from "~components/brand"
import { AppFrame, RouterLink } from "~app/app-frame"
import { jobs } from "~app/data"
import { APPLY_TABS } from "./apply-board"

const GROUPS: Stage[] = ["saved", "applied", "interview", "offer", "closed"]

/** Apply list: rows grouped by stage. */
export default function ApplyList() {
  const nav = useNavigate()
  const [closed, setClosed] = useState<Record<string, boolean>>({
    closed: true,
  })
  return (
    <AppFrame>
      <PageHeader title="Apply">
        <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />}>
          New job
        </Button>
      </PageHeader>
      <Toolbar tabs={APPLY_TABS} active="/apply/list" link={RouterLink}>
        <IconButton label="Filter">
          <ListFilter />
        </IconButton>
        <IconButton label="Display">
          <SlidersHorizontal />
        </IconButton>
      </Toolbar>
      <div className="flex flex-col gap-1 overflow-y-auto p-3">
        {GROUPS.map((stage) => {
          const list = jobs.filter((j) => j.stage === stage)
          return (
            <ListGroup
              key={stage}
              stage={stage}
              count={list.length}
              open={!closed[stage]}
              onToggle={() => setClosed((c) => ({ ...c, [stage]: !c[stage] }))}
              onAdd={() => {}}
            >
              {list.map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  onClick={() => nav(`/apply/${j.id}`)}
                />
              ))}
            </ListGroup>
          )
        })}
      </div>
    </AppFrame>
  )
}
