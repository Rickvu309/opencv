import type {
  ActivityRow,
  ChecklistItem,
  Job,
  JobDetail,
  JobPreview,
  JobStage,
  LinkedDoc,
} from "@/features/apply/apply-api.ts"
import { jsonError, jsonOk, pathOf, urlOf } from "./mock-http.ts"

type Extra = {
  note: string
  checklist: ChecklistItem[]
  linked: { cv: LinkedDoc; letter: LinkedDoc }
  activity: ActivityRow[]
  previousStage: JobStage | null
}

type Post = {
  name: string
  input: Record<string, unknown>
  activityId: string
}

const jobs: Job[] = []
const extras = new Map<string, Extra>()
const posts: Post[] = []
const previews: { url?: string; text?: string }[] = []

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
  const row: ActivityRow = {
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
    reversible: name === "job.create" || name === "job.move",
  }
  if (row.subjectId) extra(row.subjectId).activity.unshift(row)
  return activityId
}

export function resetMockJobs() {
  jobs.splice(0)
  extras.clear()
  posts.splice(0)
  previews.splice(0)
}

export function setMockJobs(
  next: Array<
    Job & {
      note?: string
      checklist?: ChecklistItem[]
      linked?: { cv: LinkedDoc; letter: LinkedDoc }
      activity?: ActivityRow[]
    }
  >
) {
  jobs.splice(0, jobs.length, ...next.map((job) => ({ ...job })))
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

function detailOf(job: Job): JobDetail {
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
      },
    }
  }
  if (url.includes("jobs.example.com")) {
    return {
      status: "unreadable",
      message: "Can't read this link. Paste the job text below.",
    }
  }
  const duplicate = jobs.find((job) => job.jobUrl && job.jobUrl === url)
  if (duplicate) {
    return {
      status: "duplicate",
      jobId: duplicate.id,
      stage: duplicate.stage,
      fields: { title: duplicate.title, company: duplicate.company },
    }
  }
  if (url.includes("company-missing") || url.includes("no-company")) {
    return { status: "company-missing", fields: { title: "Filled role" } }
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
  if (url.includes("unreadable")) {
    return {
      status: "unreadable",
      message: "Can't read this link. Paste the job text below.",
    }
  }
  if (input.text?.trim()) {
    return {
      status: "filled",
      fields: {
        title: "Pasted role",
        company: "Pasted company",
        description: input.text,
      },
    }
  }
  if (url) {
    return {
      status: "filled",
      fields: { title: "Filled role", company: "Filled company" },
    }
  }
  return {
    status: "unreadable",
    message: "Can't read this link. Paste the job text below.",
  }
}

function inRange(job: Job, from: string, to: string) {
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
    path.startsWith("/api/activity") ||
    path.includes("/api/commands/job.") ||
    path.endsWith("/api/commands/activity.undo")
  if (!jobPath) return null

  if (method === "GET" && path === "/api/jobs") {
    // Shell favorites seed their own list. An empty apply store must not hide it.
    if (jobs.length === 0) return null
    return jsonOk(jobs)
  }

  if (method === "GET" && path === "/api/jobs/calendar") {
    const from = urlOf(input).searchParams.get("from") ?? ""
    const to = urlOf(input).searchParams.get("to") ?? ""
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

  const one = /^\/api\/jobs\/([^/]+)$/.exec(path)
  if (method === "GET" && one) {
    const job = jobs.find((item) => item.id === one[1])
    if (!job) return jsonError(404, "NOT_FOUND", "Job not found")
    return jsonOk(detailOf(job))
  }

  if (method === "POST" && path === "/api/jobs/preview") {
    const body = readBody(init) as { url?: string; text?: string }
    previews.push(body)
    return jsonOk(previewFor(body))
  }

  if (method === "GET" && path === "/api/activity") {
    const subjectId = urlOf(input).searchParams.get("subjectId") ?? ""
    const subjectKind = urlOf(input).searchParams.get("subjectKind") ?? ""
    const rows = extra(subjectId).activity.filter(
      (row) => row.subjectKind === subjectKind && row.subjectId === subjectId
    )
    return jsonOk(rows)
  }

  if (method === "POST" && path.startsWith("/api/commands/")) {
    const name = path.slice("/api/commands/".length)
    const payload = commandInput(readBody(init))
    if (name === "activity.undo") {
      const activityId = String(payload.activityId ?? "")
      let found = false
      for (const [jobId, more] of extras) {
        const row = more.activity.find((item) => item.id === activityId)
        if (!row) continue
        found = true
        row.undoneAt = new Date().toISOString()
        const job = jobs.find((item) => item.id === jobId)
        if (job && more.previousStage) job.stage = more.previousStage
      }
      if (!found) return null
      record(name, payload)
      return jsonOk({ activityId })
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
      const created: Job = {
        id: crypto.randomUUID(),
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
      return jsonOk({ ...created, activityId })
    }
    const job = jobs.find((item) => item.id === jobId)
    if (!job) return jsonError(404, "NOT_FOUND", "Job not found")
    if (name === "job.move") {
      extra(job.id).previousStage = job.stage
      job.stage = payload.stage as JobStage
      job.updatedAt = new Date().toISOString()
      return jsonOk({ ...job, activityId })
    }
    if (name === "job.update") {
      const patch = (payload.patch ?? {}) as Partial<Job>
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
      const item: ChecklistItem = {
        id: crypto.randomUUID(),
        label: String(payload.label ?? ""),
        done: false,
        position: `c${extra(job.id).checklist.length}`,
      }
      extra(job.id).checklist.push(item)
      return jsonOk(item)
    }
    if (name === "job.setChecklistItem") {
      const item = extra(job.id).checklist.find(
        (row) => row.id === payload.itemId
      )
      if (!item) return jsonError(404, "NOT_FOUND", "Step not found")
      item.done = Boolean(payload.done)
      return jsonOk(item)
    }
    if (name === "job.removeChecklistItem") {
      const more = extra(job.id)
      more.checklist = more.checklist.filter((row) => row.id !== payload.itemId)
      return jsonOk({ id: String(payload.itemId) })
    }
    if (name === "job.addNote") {
      extra(job.id).note = String(payload.body ?? "")
      return jsonOk({ jobId, body: payload.body })
    }
    if (name === "job.linkPaper") {
      const doc = { id: String(payload.docId), name: String(payload.docId) }
      if (payload.kind === "letter") {
        job.letterDocId = doc.id
        extra(job.id).linked.letter = doc
      } else {
        job.cvDocId = doc.id
        extra(job.id).linked.cv = doc
      }
      return jsonOk(job)
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
