import { useParams } from "@tanstack/react-router"

import { ApplyJobDetail } from "@/features/apply/apply-job-detail.tsx"

export function ApplyJobPage() {
  const { jobId } = useParams({ strict: false }) as { jobId: string }
  return <ApplyJobDetail jobId={jobId} />
}
