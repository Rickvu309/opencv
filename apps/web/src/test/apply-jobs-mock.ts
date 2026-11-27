import { vi } from "vitest"
import { parseJobId, parsePaperId } from "@workspace/domain/kernel"
import type {
  JobDetail,
  JobPreview,
  JobStage,
  JobView,
} from "@workspace/domain/apply"

import { undoneActivityRow } from "@/test/control-fixtures.ts"
import type { ActivityFeedRow } from "@workspace/domain/account"

import type { ChecklistItem } from "@/features/apply/apply-api.ts"
import { jsonError, jsonOk, pathOf } from "./mock-http.ts"

type LinkedDoc = JobDetail["linked"]["cv"]

type Extra = {
  note: string
  checklist: ChecklistItem[]
  linked: { cv: LinkedDoc; letter: LinkedDoc }
  activity: ActivityFeedRow[]
  previousPriority?: JobView["priority"]
  previousStage: JobStage | null
}

type Post = {
  name: string
  input: Record<string, unknown>
  activityId: string
}

const jobs: JobView[] = []
const extras = new Map<string, Extra>()
const posts: Post[] = []
const previews: { url?: string; text?: string }[] = []
let failNextChecklistItem = false
let failNextNote = false
let failNextJobUpdate = false
let refuseNextUndo: string | null = null
let nextJobUpdate: Promise<void> | null = null
let failingRead: { name: string; seen: () => void } | null = null

function blankExtra(): Extra {
  return {
    note: "",
    checklist: [],
    linked: { cv: null, letter: null },
    activity: [],
    previousStage: null,
  }
}

function extra(id: string) {
  const current = extras.get(id)
  if (current) return current
  const created = blankExtra()
  extras.set(id, created)
  return created
}

function readBody(init?: RequestInit): Record<string, unknown> {
  if (init?.body == null) return {}
  const text = String(init.body)
  if (text.trim() === "") return {}
  return JSON.parse(text) as Record<string, unknown>
}

function commandInput(body: Record<string, unknown>) {
  if (body.input && typeof body.input === "object") {
    return body.input as Record<string, unknown>
  }
  return body
}

function record(name: string, input: Record<string, unknown>) {
  const activityId = crypto.randomUUID()
  posts.push({ name, input, activityId })
  const row: ActivityFeedRow = {
    id: activityId,
    createdAt: new Date().toISOString(),
    actor: "person",
    command: name,
    subjectKind: "job",
    subjectId: String(input.jobId ?? ""),
    summary:
      name === "job.create"
        ? `You added this job from ${String(input.sourceHost ?? "the board")}`
        : name === "job.move"
          ? `You moved it to ${String(input.stage)}`
          : name === "job.addNote"
            ? String(input.body ?? "")
            : name,
    undoneAt: null,
    reversible:
      name === "job.create" ||
      name === "job.move" ||
      name === "job.setPriority",
  }
  if (row.subjectId) extra(row.subjectId).activity.unshift(row)
  return activityId
}

export function resetMockJobs() {
  failingRead = null
  jobs.splice(0)
  extras.clear()
  posts.splice(0)
  previews.splice(0)
  failNextChecklistItem = false
  failNextNote = false
  failNextJobUpdate = false
  refuseNextUndo = null
  nextJobUpdate = null
}

export function refuseNextUndoWith(message: string) {
  refuseNextUndo = message
}

export function rejectNextChecklistItem() {
  failNextChecklistItem = true
}

export function rejectNextNote() {
  failNextNote = true
}

export function rejectNextJobUpdate() {
  failNextJobUpdate = true
}

export function deferNextJobUpdate() {
  let release = () => {}
  nextJobUpdate = new Promise<void>((resolve) => {
    release = resolve
  })
  return () => release()
}

function jobFieldsOf(job: Record<string, unknown>) {
  const copy = { ...job }
  for (const extra of ["note", "checklist", "linked", "activity"])
    delete copy[extra]
  return copy as JobView
}

export function setMockJobs(
  next: Array<
    JobView & {
      note?: string
      checklist?: ChecklistItem[]
      linked?: { cv: LinkedDoc; letter: LinkedDoc }
      activity?: ActivityFeedRow[]
    }
  >
) {
  jobs.splice(0, jobs.length, ...next.map(jobFieldsOf))
  extras.clear()
  for (const job of next) {
    extras.set(job.id, {
      note: job.note ?? "",
      checklist: job.checklist ?? [],
      linked: job.linked ?? { cv: null, letter: null },
      activity: job.activity ?? [],
      previousStage: null,
    })
  }
}

export function getMockJobs() {
  return jobs
}

export function getMockJobPosts() {
  return posts
}

export function getMockPreviews() {
  return previews
}

function detailOf(job: JobView): JobDetail {
  const more = extra(job.id)
  return {
    ...job,
    note: more.note,
    checklist: more.checklist,
    linked: more.linked,
  }
}

function previewFor(input: { url?: string; text?: string }): JobPreview {
  const url = input.url?.trim() ?? ""
  if (url.includes("create-duplicate")) {
    return {
      status: "filled",
      fields: {
        title: "Associate Product Manager Intern",
        company: "Northwind Labs",
        location: "Hanoi",
        description: "",
      },
    }
  }
  if (url.includes("jobs.example.com")) {
    return {
      status: "unreadable",
      fields: {},
      message: "Can't read this link. Paste the job text below.",
    }
  }
  const duplicate = jobs.find((job) => job.jobUrl && job.jobUrl === url)
  if (duplicate) {
    return {
      status: "duplicate",
      jobId: duplicate.id,
      stage: duplicate.stage,
      fields: {
        title: duplicate.title,
        company: duplicate.company,
        location: duplicate.location ?? "",
      },
    }
  }
  if (url.includes("company-missing") || url.includes("no-company")) {
    return {
      status: "company-missing",
      fields: { title: "Filled role", company: "", location: "" },
    }
  }
  if (url.includes("careers.verify-posting.dev")) {
    return {
      status: "filled",
      fields: {
        title: "Associate Product Manager Intern",
        company: "Northwind Labs",
        location: "Hanoi",
        description: "Northwind is hiring an associate product manager intern.",
      },
    }
  }
  if (url.includes("junior-marketing-lumiere")) {
    return {
      status: "filled",
      fields: {
        title: "Junior Marketing",
        company: "Lumière Cosmetics",
        location: "HCMC",
        description:
          "Plan and run social campaigns for three skincare brands. Write short posts and TikTok scripts, and report weekly reach. Vietnamese and English.",
      },
    }
  }
  if (url.includes("unreadable")) {
    return {
      status: "unreadable",
      fields: {},
      message: "Can't read this link. Paste the job text below.",
    }
  }
  if (input.text?.trim()) {
    return {
      status: "filled",
      fields: {
        title: "Pasted role",
        company: "Pasted company",
        location: "",
        description: input.text,
      },
    }
  }
  if (url) {
    return {
      status: "filled",
      fields: {
        title: "Filled role",
        company: "Filled company",
        location: "",
        description: "",
      },
    }
  }
  return {
    status: "unreadable",
    fields: {},
    message: "Can't read this link. Paste the job text below.",
  }
}

function inRange(job: JobView, from: string, to: string) {
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  if (job.interviewAt) {
    const at = Date.parse(job.interviewAt)
    if (at >= start && at < end) return true
  }
  if (job.deadline) {
    const at = Date.parse(`${job.deadline}T00:00:00.000Z`)
    if (at >= start && at < end) return true
  }
  return false
}

export async function jobApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()
  const jobPath =
    path.startsWith("/api/jobs") ||
    path === "/api/reads/activity.list" ||
    path === "/api/reads/job.list" ||
    path === "/api/reads/job.get" ||
    path === "/api/reads/job.calendar" ||
    path === "/api/reads/job.preview" ||
    path.includes("/api/commands/job.") ||
    path.endsWith("/api/commands/activity.undo") ||
    path === "/api/reads/job.priorityCounts"
  if (!jobPath) return null
  if (failingRead && path === `/api/reads/${failingRead.name}`) {
    failingRead.seen()
    return jsonError(500, "INTERNAL", "Request failed")
  }

  if (method === "POST" && path === "/api/reads/job.list") {
    const emptyStoreLeavesShellFavoritesVisible = jobs.length === 0
    if (emptyStoreLeavesShellFavoritesVisible) return null
    return jsonOk(jobs)
  }

  if (method === "POST" && path === "/api/reads/job.priorityCounts") {
    return jsonOk(
      (["low", "normal", "high"] as const).map((priority) => ({
        priority,
        count: jobs.filter((job) => job.priority === priority).length,
      }))
    )
  }

  if (method === "POST" && path === "/api/reads/job.calendar") {
    const range = readBody(init) as { from?: string; to?: string }
    const from = range.from ?? ""
    const to = range.to ?? ""
    if (
      !from ||
      !to ||
      Number.isNaN(Date.parse(from)) ||
      Number.isNaN(Date.parse(to))
    ) {
      return jsonError(400, "VALIDATION_ERROR", "Use a from and to date.")
    }
    return jsonOk(jobs.filter((job) => inRange(job, from, to)))
  }

  if (method === "POST" && path === "/api/reads/job.get") {
    const { jobId } = readBody(init) as { jobId?: string }
    const job = jobs.find((item) => item.id === jobId)
    if (!job) return jsonError(404, "NOT_FOUND", "Job not found")
    return jsonOk(detailOf(job))
  }

  if (method === "POST" && path === "/api/reads/job.preview") {
    const body = readBody(init) as { url?: string; text?: string }
    previews.push(body)
    return jsonOk(previewFor(body))
  }

  if (method === "POST" && path === "/api/reads/activity.list") {
    const read = (readBody(init) ?? {}) as {
      subjectId?: string
      subjectKind?: string
    }
    const subjectId = read.subjectId ?? ""
    const subjectKind = read.subjectKind ?? ""
    const rows = extra(subjectId).activity.filter(
      (row) => row.subjectKind === subjectKind && row.subjectId === subjectId
    )
    return jsonOk(
      rows.map((row) => ({ ...row, reversible: Boolean(row.reversible) }))
    )
  }

  if (method === "POST" && path.startsWith("/api/commands/")) {
    const name = path.slice("/api/commands/".length)
    const payload = commandInput(readBody(init))
    if (name === "activity.undo" && refuseNextUndo) {
      const message = refuseNextUndo
      refuseNextUndo = null
      return jsonError(409, "CONFLICT", message)
    }
    if (name === "activity.undo") {
      const activityId = String(payload.activityId ?? "")
      for (const [jobId, more] of extras) {
        const row = more.activity.find((item) => item.id === activityId)
        if (!row) continue
        row.undoneAt = new Date().toISOString()
        const job = jobs.find((item) => item.id === jobId)
        if (job && more.previousPriority) job.priority = more.previousPriority
        if (job && more.previousStage) job.stage = more.previousStage
      }
      record(name, payload)
      return jsonOk(undoneActivityRow(activityId))
    }
    if (!name.startsWith("job.")) return null
    const activityId = record(name, payload)
    const jobId = String(payload.jobId ?? "")
    if (name === "job.create") {
      const company = String(payload.company ?? "").trim()
      const title = String(payload.title ?? "").trim()
      if (!company && payload.anyway !== true) {
        return jsonError(
          400,
          "COMPANY_REQUIRED",
          "Add the company name to save this job."
        )
      }
      const url = payload.jobUrl ? String(payload.jobUrl) : null
      if (url && payload.anyway !== true) {
        const existing = jobs.find((job) => job.jobUrl === url)
        const named =
          existing ?? (url.includes("create-duplicate") ? jobs[0] : undefined)
        if (named && (existing || url.includes("create-duplicate"))) {
          return jsonError(
            409,
            "DUPLICATE_JOB",
            "You already saved a job with this link.",
            { jobId: named.id, stage: named.stage }
          )
        }
      }
      const now = new Date().toISOString()
      const created: JobView = {
        id: parseJobId(crypto.randomUUID()),
        title,
        company,
        stage: (payload.stage as JobStage) || "saved",
        position: `p${jobs.length}`,
        location: payload.location ? String(payload.location) : null,
        priority: "normal",
        jobUrl: url,
        sourceHost: payload.sourceHost ? String(payload.sourceHost) : null,
        description: payload.description ? String(payload.description) : "",
        posting:
          url && url.includes("careers.verify-posting.dev")
            ? {
                about:
                  "Northwind is hiring an associate product manager intern.",
                duties: "Ship a small slice of the product.",
                requirements: "Curiosity and clear writing.",
                details: "Hanoi.",
              }
            : null,
        interviewAt: null,
        deadline: payload.deadline ? String(payload.deadline) : null,
        recruiterName: null,
        recruiterEmail: null,
        cvDocId: null,
        letterDocId: null,
        starred: false,
        createdAt: now,
        updatedAt: now,
      }
      jobs.push(created)
      const more = extra(created.id)
      more.activity = extra("").activity.filter((row) => row.subjectId === "")
      extra("").activity = extra("").activity.filter(
        (row) => row.subjectId !== ""
      )
      more.activity.unshift({
        id: activityId,
        createdAt: now,
        actor: "person",
        command: name,
        subjectKind: "job",
        subjectId: created.id,
        summary: `You added this job from ${created.sourceHost ?? "the board"}`,
        undoneAt: null,
        reversible: true,
      })
      return jsonOk({
        ...created,
        sourceLabel: created.sourceHost ?? "the board",
        activityId,
      })
    }
    const job = jobs.find((item) => item.id === jobId)
    if (!job) return jsonError(404, "NOT_FOUND", "Job not found")
    if (name === "job.setPriority") {
      extra(job.id).previousPriority = job.priority
      job.priority = payload.priority as JobView["priority"]
      return jsonOk({ ...job, activityId })
    }
    if (name === "job.move") {
      const fromStage = job.stage
      extra(job.id).previousStage = fromStage
      job.stage = payload.stage as JobStage
      job.updatedAt = new Date().toISOString()
      return jsonOk({ ...job, fromStage, activityId })
    }
    if (name === "job.update") {
      const pending = nextJobUpdate
      nextJobUpdate = null
      if (pending) await pending
      if (failNextJobUpdate) {
        failNextJobUpdate = false
        return jsonError(503, "UNAVAILABLE", "Temporary failure")
      }
      const patch = (payload.patch ?? {}) as Partial<JobView>
      Object.assign(job, patch, { updatedAt: new Date().toISOString() })
      return jsonOk(job)
    }
    if (name === "job.star") {
      job.starred = Boolean(payload.starred)
      return jsonOk(job)
    }
    if (name === "job.delete") {
      const index = jobs.findIndex((item) => item.id === jobId)
      if (index >= 0) jobs.splice(index, 1)
      return jsonOk({ id: jobId })
    }
    if (name === "job.addChecklistItem") {
      if (failNextChecklistItem) {
        failNextChecklistItem = false
        return jsonError(503, "UNAVAILABLE", "Temporary failure")
      }
      const item: ChecklistItem = {
        id: crypto.randomUUID(),
        label: String(payload.label ?? ""),
        done: false,
        position: `c${extra(job.id).checklist.length}`,
      }
      extra(job.id).checklist.push(item)
      return jsonOk({ ...item, jobId: job.id, activityId })
    }
    if (name === "job.setChecklistItem") {
      const item = extra(job.id).checklist.find(
        (row) => row.id === payload.itemId
      )
      if (!item) return jsonError(404, "NOT_FOUND", "Step not found")
      item.done = Boolean(payload.done)
      return jsonOk({ ...item, jobId: job.id, activityId })
    }
    if (name === "job.removeChecklistItem") {
      const more = extra(job.id)
      more.checklist = more.checklist.filter((row) => row.id !== payload.itemId)
      return jsonOk({ id: String(payload.itemId) })
    }
    if (name === "job.addNote") {
      if (failNextNote) {
        failNextNote = false
        return jsonError(503, "UNAVAILABLE", "Temporary failure")
      }
      extra(job.id).note = String(payload.body ?? "")
      return jsonOk({ jobId, body: payload.body })
    }
    if (name === "job.linkPaper") {
      const doc = {
        id: parsePaperId(String(payload.docId)),
        name: String(payload.docId),
      }
      if (payload.kind === "letter") {
        job.letterDocId = doc.id
        extra(job.id).linked.letter = doc
      } else {
        job.cvDocId = doc.id
        extra(job.id).linked.cv = doc
      }
      return jsonOk({ ...job, docName: doc.name })
    }
    if (name === "job.unlinkPaper") {
      if (payload.kind === "letter") {
        job.letterDocId = null
        extra(job.id).linked.letter = null
      } else {
        job.cvDocId = null
        extra(job.id).linked.cv = null
      }
      return jsonOk(job)
    }
    return jsonError(404, "NOT_FOUND", "Unknown command")
  }

  return null
}

export function failJobRead(name: "job.list" | "job.get") {
  const seen = vi.fn()
  failingRead = { name, seen }
  return seen
}
