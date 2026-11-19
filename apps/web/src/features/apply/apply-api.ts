import { useQuery, type QueryClient } from "@tanstack/react-query"
import type {
  JobDetail,
  JobId,
  QueryInput,
  QueryOutput,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { queryKey } from "@/lib/contract-client.ts"
import { endpoints } from "@/lib/requests.ts"

export type ChecklistItem = JobDetail["checklist"][number]

export type PaperListItem = {
  id: string
  name: string
  kind: string
}

export function ownerIdFromRouteMatches(
  matches: readonly { context: unknown }[]
) {
  for (const match of matches) {
    if (!match.context || typeof match.context !== "object") continue
    const session = (match.context as { session?: unknown }).session
    if (!session || typeof session !== "object") continue
    const user = (session as { user?: unknown }).user
    if (!user || typeof user !== "object") continue
    const id = (user as { id?: unknown }).id
    if (typeof id === "string" && id) return id
  }
  return ""
}

export const jobListKey = () => queryKey({ query: "job.list" })
export const jobGetKey = (jobId: JobId) =>
  queryKey({ query: "job.get", input: { jobId } })
export const jobCalendarKey = (from: string, to: string) =>
  queryKey({ query: "job.calendar", input: { from, to } })

export function listJobs(): Promise<QueryOutput<"job.list">> {
  return apiFetch<SuccessBody<QueryOutput<"job.list">>>(endpoints.jobs).then(
    unwrapData
  )
}

export function getJob(jobId: JobId): Promise<QueryOutput<"job.get">> {
  return apiFetch<SuccessBody<QueryOutput<"job.get">>>(
    endpoints.job(jobId)
  ).then(unwrapData)
}

export function prefetchJob(queryClient: QueryClient, jobId: JobId) {
  void queryClient.prefetchQuery({
    queryKey: jobGetKey(jobId),
    queryFn: () => getJob(jobId),
    staleTime: 30_000,
  })
}

export function calendarJobs(
  from: string,
  to: string
): Promise<QueryOutput<"job.calendar">> {
  const query = new URLSearchParams({ from, to })
  return apiFetch<SuccessBody<QueryOutput<"job.calendar">>>(
    endpoints.jobsCalendar(query)
  ).then(unwrapData)
}

export function previewJob(
  input: QueryInput<"job.preview">
): Promise<QueryOutput<"job.preview">> {
  return apiFetch<SuccessBody<QueryOutput<"job.preview">>>(
    endpoints.jobsPreview,
    { method: "POST", body: JSON.stringify(input) }
  ).then(unwrapData)
}

export function listActivity(jobId: string) {
  const query = new URLSearchParams({
    subjectKind: "job",
    subjectId: jobId,
  })
  return apiFetch<SuccessBody<QueryOutput<"activity.list">>>(
    endpoints.activity(query)
  ).then(unwrapData)
}

export function listPaper(kind: "cv" | "letter"): Promise<PaperListItem[]> {
  return apiFetch<SuccessBody<PaperListItem[]>>(
    endpoints.paperOfKind(kind)
  ).then(unwrapData)
}

export type ApplyPickerCard = {
  id: string
  title: string
  company: string
  stage: QueryOutput<"job.list">[number]["stage"]
  starred: boolean
}

export function useApplyPickerCards() {
  const listQuery = useQuery({
    queryKey: jobListKey(),
    queryFn: listJobs,
  })
  const cards: ApplyPickerCard[] = (listQuery.data ?? []).map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    stage: job.stage,
    starred: job.starred,
  }))
  return {
    cards,
    isLoading: listQuery.isLoading,
  }
}
