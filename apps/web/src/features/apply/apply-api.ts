import { useQuery, type QueryClient } from "@tanstack/react-query"
import {
  catalog,
  type JobDetail,
  type JobId,
  type QueryOutput,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { catalogClient, queryKey } from "@/lib/contract-client.ts"
import { endpoints } from "@/lib/requests.ts"

export type ChecklistItem = JobDetail["checklist"][number]

export type PaperListItem = {
  id: string
  name: string
  kind: string
}

export const jobListKey = () => queryKey({ query: "job.list" })
export const jobGetKey = (jobId: JobId) =>
  queryKey({ query: "job.get", input: { jobId } })

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

export function previewJob(input: { url?: string; text?: string }) {
  return catalogClient.read(catalog["job.preview"].name, input)
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
