import { useQuery, type QueryClient } from "@tanstack/react-query"
import {
  catalog,
  type JobDetail,
  type JobId,
  type QueryOutput,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { useOwnerId } from "@/lib/owner-id.ts"
import { endpoints } from "@/lib/requests.ts"

export type ChecklistItem = JobDetail["checklist"][number]

export type PaperListItem = {
  id: string
  name: string
  kind: string
}

export function jobListQuery(ownerId: string) {
  return catalogClient.options(ownerId, "job.list", {})
}

export function jobGetQuery(ownerId: string, jobId: JobId) {
  return catalogClient.options(ownerId, "job.get", { jobId })
}

export function listJobs() {
  return catalogClient.read(catalog["job.list"].name, {})
}

export function prefetchJob(
  queryClient: QueryClient,
  ownerId: string,
  jobId: JobId
) {
  void queryClient.prefetchQuery({
    ...jobGetQuery(ownerId, jobId),
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
  const listQuery = useQuery(jobListQuery(useOwnerId()))
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
