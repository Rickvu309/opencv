import { useParams } from "@tanstack/react-router"
import { jobIdSchema } from "@workspace/domain"

import { ApplyJobDetail } from "@/features/apply/apply-job-detail.tsx"

export function ApplyJobPage() {
  const { jobId } = useParams({ strict: false }) as { jobId: string }
  const parsed = jobIdSchema.safeParse(jobId)
  if (!parsed.success)
    return <p className="p-6 text-sm">Could not load jobs. Check the link.</p>
  return <ApplyJobDetail key={parsed.data} jobId={parsed.data} />
}
