import { useNavigate } from "@tanstack/react-router"

import type { Job, JobStage } from "./apply-api.ts"
import { JobRow, ListGroup } from "./apply-parts.tsx"
import {
  ALL_STAGES,
  compareJobs,
  listPhrase,
  stageLabel,
} from "./apply-stages.ts"

export function ApplyList({
  jobs,
  showClosed,
}: {
  jobs: Job[]
  showClosed: boolean
}) {
  const navigate = useNavigate()
  const stages = (
    showClosed ? ALL_STAGES : ALL_STAGES.filter((stage) => stage !== "closed")
  ) as JobStage[]
  const grouped = stages
    .map((stage) => ({
      stage,
      jobs: jobs.filter((job) => job.stage === stage).sort(compareJobs),
    }))
    .filter((group) => group.jobs.length > 0)

  return (
    <div className="flex flex-col gap-2">
      {grouped.map((group) => (
        <ListGroup key={group.stage} name={stageLabel(group.stage)}>
          {group.jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              phrase={listPhrase(job)}
              onOpen={() =>
                void navigate({
                  to: "/app/apply/$jobId",
                  params: { jobId: job.id },
                })
              }
            />
          ))}
        </ListGroup>
      ))}
    </div>
  )
}
