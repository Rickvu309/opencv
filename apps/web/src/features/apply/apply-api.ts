import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export type JobStage = "saved" | "applied" | "interview" | "offer" | "closed"
export type JobPriority = "low" | "normal" | "high"

export type JobPosting = {
  about: string
  duties: string
  requirements: string
  details: string
}

export type Job = {
  id: string
  title: string
  company: string
  stage: JobStage
  position: string
  location: string | null
  priority: JobPriority
  jobUrl: string | null
  sourceHost: string | null
  description: string | null
  posting: JobPosting | null
  interviewAt: string | null
  deadline: string | null
  recruiterName: string | null
  recruiterEmail: string | null
  cvDocId: string | null
  letterDocId: string | null
  starred: boolean
  createdAt: string
  updatedAt: string
}

export type ChecklistItem = {
  id: string
  label: string
  done: boolean
  position: string
}

export type LinkedDoc = { id: string; name: string } | null

export type JobDetail = Job & {
  note: string
  checklist: ChecklistItem[]
  linked: { cv: LinkedDoc; letter: LinkedDoc }
}

export type JobPreview = {
  status: "filled" | "company-missing" | "duplicate" | "unreadable"
  fields?: {
    title?: string
    company?: string
    location?: string
    description?: string
  }
  jobId?: string
  stage?: JobStage
  message?: string
}

export type ActivityRow = {
  id: string
  createdAt: string
  actor: string
  command: string
  subjectKind: string
  subjectId: string
  summary: string
  undoneAt: string | null
  reversible?: boolean
}

export type PaperListItem = {
  id: string
  name: string
  kind: string
}

export type CommandResult<T> = T & { activityId?: string }

export const applyQueryKeys = {
  all: ["apply"] as const,
  list: () => ["apply", "list"] as const,
  /** Compat card list for Paper. Not the job board. */
  cards: () => ["apply", "cards"] as const,
  detail: (id: string) => ["apply", "detail", id] as const,
  calendar: (from: string, to: string) =>
    ["apply", "calendar", from, to] as const,
  activity: (id: string) => ["apply", "activity", id] as const,
}

async function postCommand<T>(
  name: string,
  input: unknown
): Promise<CommandResult<T>> {
  const body = await apiFetch<SuccessBody<CommandResult<T>>>(
    `/api/commands/${name}`,
    {
      method: "POST",
      body: JSON.stringify({
        input,
        idempotencyKey: crypto.randomUUID(),
      }),
    }
  )
  return unwrapData(body)
}

export function listJobs(): Promise<Job[]> {
  return apiFetch<SuccessBody<Job[]>>("/api/jobs").then(unwrapData)
}

export function getJob(jobId: string): Promise<JobDetail> {
  return apiFetch<SuccessBody<JobDetail>>(`/api/jobs/${jobId}`).then(unwrapData)
}

export function calendarJobs(from: string, to: string): Promise<Job[]> {
  const query = new URLSearchParams({ from, to })
  return apiFetch<SuccessBody<Job[]>>(`/api/jobs/calendar?${query}`).then(
    unwrapData
  )
}

export function previewJob(input: {
  url?: string
  text?: string
}): Promise<JobPreview> {
  return apiFetch<SuccessBody<JobPreview>>("/api/jobs/preview", {
    method: "POST",
    body: JSON.stringify(input),
  }).then(unwrapData)
}

export function createJob(input: {
  title: string
  company?: string
  stage?: JobStage
  description?: string
  jobUrl?: string
  location?: string
  deadline?: string
  sourceHost?: string
  anyway?: true
}): Promise<CommandResult<Job>> {
  return postCommand<Job>("job.create", input)
}

export function moveJob(input: {
  jobId: string
  stage: JobStage
  position?: string
}): Promise<CommandResult<Job>> {
  return postCommand<Job>("job.move", input)
}

export function updateJob(input: {
  jobId: string
  patch: Partial<{
    title: string
    company: string
    location: string | null
    priority: JobPriority
    interviewAt: string | null
    deadline: string | null
    recruiterName: string | null
    recruiterEmail: string | null
    description: string | null
    jobUrl: string | null
    posting: JobPosting
  }>
}): Promise<Job> {
  return postCommand<Job>("job.update", input)
}

export function starJob(input: {
  jobId: string
  starred: boolean
}): Promise<Job> {
  return postCommand<Job>("job.star", input)
}

export function deleteJob(input: { jobId: string }): Promise<{ id: string }> {
  return postCommand<{ id: string }>("job.delete", input)
}

export function addChecklistItem(input: {
  jobId: string
  label: string
}): Promise<ChecklistItem> {
  return postCommand<ChecklistItem>("job.addChecklistItem", input)
}

export function setChecklistItem(input: {
  jobId: string
  itemId: string
  done: boolean
}): Promise<ChecklistItem> {
  return postCommand<ChecklistItem>("job.setChecklistItem", input)
}

export function removeChecklistItem(input: {
  jobId: string
  itemId: string
}): Promise<{ id: string }> {
  return postCommand<{ id: string }>("job.removeChecklistItem", input)
}

export function addNote(input: {
  jobId: string
  body: string
}): Promise<{ jobId: string; body: string }> {
  return postCommand("job.addNote", input)
}

export function linkPaper(input: {
  jobId: string
  docId: string
  kind: "cv" | "letter"
}): Promise<Job> {
  return postCommand<Job>("job.linkPaper", input)
}

export function unlinkPaper(input: {
  jobId: string
  kind: "cv" | "letter"
}): Promise<Job> {
  return postCommand<Job>("job.unlinkPaper", input)
}

export function listActivity(jobId: string): Promise<ActivityRow[]> {
  const query = new URLSearchParams({
    subjectKind: "job",
    subjectId: jobId,
  })
  return apiFetch<SuccessBody<ActivityRow[]>>(`/api/activity?${query}`).then(
    unwrapData
  )
}

export function undoActivity(input: { activityId: string }): Promise<unknown> {
  return postCommand("activity.undo", input)
}

export function listPaper(kind: "cv" | "letter"): Promise<PaperListItem[]> {
  return apiFetch<SuccessBody<PaperListItem[]>>(`/api/paper?kind=${kind}`).then(
    unwrapData
  )
}

export type ApplyPickerCard = {
  id: string
  title: string
  company: string
  stage: JobStage
  starred: boolean
}

/** Paper's picker reads jobs until #378 owns the attach flow. */
export function useApplyCards() {
  const listQuery = useQuery({
    queryKey: applyQueryKeys.list(),
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
