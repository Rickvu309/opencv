import { useNavigate } from "@tanstack/react-router"

import type { JobStage, JobView } from "@workspace/domain"
import { JobRow, ListGroup } from "./apply-list-parts.tsx"
import { ALL_STAGES, compareJobs } from "./apply-stages.ts"

export function ApplyList({
  jobs,
  showClosed,
}: {
  jobs: JobView[]
  showClosed: boolean
}) {
  const navigate = useNavigate()
  const stages = (
    showClosed ? ALL_STAGES : ALL_STAGES.filter((stage) => stage !== "closed")
  ) as JobStage[]

  return (
    <div className="flex flex-col gap-2.5 bg-card px-3 pt-2.5 pb-5">
      {stages.map((stage) => {
        const inStage = jobs
          .filter((job) => job.stage === stage)
          .sort(compareJobs)
        return (
          <ListGroup key={stage} stage={stage} count={inStage.length}>
            {inStage.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onOpen={() =>
                  void navigate({
                    to: "/apply/$jobId",
                    params: { jobId: job.id },
                  })
                }
              />
            ))}
          </ListGroup>
        )
      })}
    </div>
  )
}
