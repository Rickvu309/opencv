import type { JobStage, JobView } from "@workspace/domain/apply"
import type { JobId } from "@workspace/domain/kernel"
import { JobRow, ListGroup } from "./apply-list-parts.tsx"
import { ALL_STAGES, compareJobs } from "./apply-stages.ts"

export function ApplyList({
  jobs,
  showClosed,
  onOpenJob,
  openJobId,
}: {
  jobs: JobView[]
  showClosed: boolean
  onOpenJob: (jobId: JobId) => void
  openJobId: string | null
}) {
  const stages = (
    showClosed ? ALL_STAGES : ALL_STAGES.filter((stage) => stage !== "closed")
  ) as JobStage[]

  return (
    <div className="flex flex-col gap-3 bg-background px-3 pt-2.5 pb-5">
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
                current={job.id === openJobId}
                onOpen={() => onOpenJob(job.id)}
              />
            ))}
          </ListGroup>
        )
      })}
    </div>
  )
}
