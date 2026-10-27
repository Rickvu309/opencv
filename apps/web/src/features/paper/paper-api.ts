import {
  PAPER_TEMPLATE_IDS,
  type PaperContentKind,
  type PaperDoc,
  type PaperDocStatus,
  type PaperTemplateId,
} from "@workspace/domain"

import { ApiError, apiFetch, apiStream } from "@/lib/api.ts"
import { runCommand, unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"
import { readSseStream } from "@/lib/sse.ts"

export const paperQueryKeys = {
  all: ["paper"] as const,
  list: () => ["paper", "list"] as const,
  detail: (id: string) => ["paper", "detail", id] as const,
  files: () => ["paper", "files"] as const,
  pages: (id: string) => ["paper", "pages", id] as const,
}

export type PaperKind = "cv" | "letter" | "proof"

export type PaperRecord = {
  id: string
  name: string
  kind: PaperKind
  templateId: string
  status: PaperDocStatus
  document: unknown
  contentVersion: number
  checks: {
    id: string
    kind: string
    message: string
    blockId?: string
    resolved?: boolean
  }[]
  pageChoice: "unset" | "keep"
  sourceFileId: string | null
  /** Present on the test mock and older list payloads. The new read omits it. */
  applyCardId: string | null
  createdAt: string
  updatedAt: string
}

export type PaperFileRecord = {
  id: string
  name: string
  mediaType: string
  byteSize: number
  createdAt: string
}

export type PaperPages = {
  docId: string
  pages: number
  pageChoice: "unset" | "keep"
}

export type JobSummary = {
  id: string
  title: string
  company: string
  posting?: { requirements?: string } | null
  cvDocId: string | null
  letterDocId: string | null
  updatedAt: string
}

export class PaperLimitError extends Error {
  readonly resetsAt: string | null

  constructor(message: string, resetsAt: string | null) {
    super(message)
    this.name = "PaperLimitError"
    this.resetsAt = resetsAt
  }
}

const TEMPLATE_IDS = new Set<string>(PAPER_TEMPLATE_IDS)

function asKind(value: unknown): PaperKind {
  if (value === "letter" || value === "proof") return value
  return "cv"
}

export function asRecord(raw: unknown): PaperRecord {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const templateId =
    typeof row.templateId === "string" && TEMPLATE_IDS.has(row.templateId)
      ? row.templateId
      : "simple"
  const document = "document" in row ? row.document : row.content
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    kind: asKind(row.kind),
    templateId,
    status:
      row.status === "ready" || row.status === "published"
        ? row.status
        : "draft",
    document,
    contentVersion:
      typeof row.contentVersion === "number" ? row.contentVersion : 1,
    checks: Array.isArray(row.checks)
      ? (row.checks as PaperRecord["checks"])
      : [],
    pageChoice: row.pageChoice === "keep" ? "keep" : "unset",
    sourceFileId:
      typeof row.sourceFileId === "string" ? row.sourceFileId : null,
    applyCardId: typeof row.applyCardId === "string" ? row.applyCardId : null,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  }
}

export function asPaperDoc(record: PaperRecord): PaperDoc {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    status: record.status,
    content: record.document,
    contentVersion: record.contentVersion,
    applyCardId: record.applyCardId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export async function listPaper(): Promise<PaperRecord[]> {
  const body = await apiFetch<SuccessBody<unknown[]>>("/api/paper")
  return unwrapData(body).map(asRecord)
}

export async function getPaper(id: string): Promise<PaperRecord> {
  const body = await apiFetch<SuccessBody<unknown>>(`/api/paper/${id}`)
  return asRecord(unwrapData(body))
}

export async function listPaperFiles(): Promise<PaperFileRecord[]> {
  const body =
    await apiFetch<SuccessBody<PaperFileRecord[]>>("/api/paper/files")
  return unwrapData(body)
}

export async function getPaperPages(id: string): Promise<PaperPages> {
  const body = await apiFetch<SuccessBody<PaperPages>>(`/api/paper/${id}/pages`)
  return unwrapData(body)
}

export function createPaper(input: {
  kind: "cv" | "letter"
  templateId?: PaperTemplateId | string
  name?: string
  jobId?: string
}): Promise<PaperRecord> {
  return runCommand<unknown>("paper.create", input).then(asRecord)
}

export function replacePaper(input: {
  docId: string
  contentVersion: number
  document: unknown
}): Promise<PaperRecord> {
  return runCommand<unknown>("paper.replace", input).then(asRecord)
}

export function renamePaper(input: {
  docId: string
  name: string
}): Promise<PaperRecord> {
  return runCommand<unknown>("paper.rename", input).then(asRecord)
}

export function duplicatePaper(docId: string): Promise<PaperRecord> {
  return runCommand<unknown>("paper.duplicate", { docId }).then(asRecord)
}

export function deletePaper(docId: string): Promise<{ docId: string }> {
  return runCommand("paper.delete", { docId })
}

export function deleteFile(fileId: string): Promise<{ fileId: string }> {
  return runCommand("paper.deleteFile", { fileId })
}

export function setPaperTemplate(
  docId: string,
  templateId: string
): Promise<PaperRecord> {
  return runCommand<unknown>("paper.setTemplate", { docId, templateId }).then(
    asRecord
  )
}

export function sharePaper(docId: string): Promise<{ token: string }> {
  return runCommand("paper.share", { docId })
}

export function keepTwoPages(docId: string): Promise<PaperRecord> {
  return runCommand<unknown>("paper.keepTwoPages", { docId }).then(asRecord)
}

export function dismissPaperCheck(
  docId: string,
  checkId: string
): Promise<PaperRecord> {
  return runCommand<unknown>("paper.dismissCheck", { docId, checkId }).then(
    asRecord
  )
}

export async function importPaperFile(
  file: File,
  signal?: AbortSignal
): Promise<PaperRecord> {
  const body = new FormData()
  body.set("file", file)
  const res = await fetch(new URL("/api/paper/import", apiBaseUrl), {
    method: "POST",
    credentials: "include",
    body,
    signal,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new ApiError(
      res.status,
      "REQUEST_FAILED",
      payload?.error?.message ?? "Could not import that file. Try it again."
    )
  }
  const payload = (await res.json()) as SuccessBody<unknown>
  return asRecord(unwrapData(payload))
}

export async function listJobs(): Promise<JobSummary[]> {
  const body = await apiFetch<SuccessBody<JobSummary[]>>("/api/jobs")
  return unwrapData(body)
}

export function linkJobPaper(input: {
  jobId: string
  docId: string
  kind: "cv" | "letter"
}): Promise<unknown> {
  return runCommand("job.linkPaper", input)
}

export function createPaperChat(title: string): Promise<{ id: string }> {
  return runCommand("chat.create", { title })
}

export function openPaperChat(docId: string): Promise<{ id: string }> {
  return runCommand("chat.open", { focus: { kind: "paper", id: docId } })
}

export function stopPaperChat(chatId: string): Promise<void> {
  return apiFetch(`/api/chats/${chatId}/stop`, { method: "POST" })
}

export async function streamPaperTurn(input: {
  chatId: string
  text: string
  focusDocId: string
  context?: { kind: "paper" | "job" | "link" | "file"; id: string }[]
  signal?: AbortSignal
  onText: (delta: string) => void
  onToolResult: (tool: string) => void
}): Promise<void> {
  let res: Response
  try {
    res = await apiStream(`/api/chats/${input.chatId}/turns`, {
      method: "POST",
      body: JSON.stringify({
        text: input.text,
        focusDocId: input.focusDocId,
        ...(input.context ? { context: input.context } : {}),
      }),
      signal: input.signal,
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      const usage = await apiFetch<SuccessBody<{ resetsAt?: string }>>(
        "/api/coach/usage"
      ).catch(() => null)
      throw new PaperLimitError(
        error.message,
        usage ? (unwrapData(usage).resetsAt ?? null) : null
      )
    }
    throw error
  }
  if (!res.body) {
    throw new ApiError(502, "REQUEST_FAILED", "Coach stream was empty")
  }
  for await (const event of readSseStream(res.body, { signal: input.signal })) {
    if (event.event === "text-delta") {
      const data = event.data as { text?: string; delta?: string }
      input.onText(data.delta ?? data.text ?? "")
    }
    if (event.event === "tool-result") {
      const data = event.data as { name?: string; tool?: string }
      input.onToolResult(data.name ?? data.tool ?? "")
    }
    if (event.event === "error") {
      const data = event.data as { message?: string }
      throw new ApiError(
        502,
        "REQUEST_FAILED",
        data.message ?? "Coach stopped."
      )
    }
  }
}

export async function latestActivityId(
  subjectId: string
): Promise<string | null> {
  const body = await apiFetch<SuccessBody<{ id: string }[]>>(
    `/api/activity?subjectId=${encodeURIComponent(subjectId)}`
  )
  return unwrapData(body)[0]?.id ?? null
}

export function undoActivity(activityId: string): Promise<unknown> {
  return runCommand("activity.undo", { activityId })
}

export async function listPaperDocs(): Promise<PaperDoc[]> {
  return (await listPaper()).map(asPaperDoc)
}

export async function getPaperDoc(id: string): Promise<PaperDoc> {
  return asPaperDoc(await getPaper(id))
}

export async function createPaperDoc(input: {
  kind: PaperContentKind
  name?: string
  content?: unknown
}): Promise<PaperDoc> {
  if (input.kind === "proof") {
    throw new ApiError(400, "VALIDATION_ERROR", "Proof is not a document kind.")
  }
  const created = await createPaper({
    kind: input.kind,
    ...(input.name ? { name: input.name } : {}),
  })
  if (input.content === undefined) return asPaperDoc(created)
  const replaced = await replacePaper({
    docId: created.id,
    contentVersion: created.contentVersion,
    document: input.content,
  })
  return asPaperDoc(replaced)
}

export async function updatePaperContent(input: {
  docId: string
  content: unknown
  contentVersion: number
}): Promise<PaperDoc> {
  return asPaperDoc(
    await replacePaper({
      docId: input.docId,
      contentVersion: input.contentVersion,
      document: input.content,
    })
  )
}

export async function renamePaperDoc(input: {
  docId: string
  name: string
}): Promise<PaperDoc> {
  return asPaperDoc(await renamePaper(input))
}

export function setPaperDocStatus(input: {
  docId: string
  status: PaperDocStatus
}): Promise<PaperDoc> {
  return runCommand<unknown>("paper.setStatus", input).then((row) =>
    asPaperDoc(asRecord(row))
  )
}

export async function deletePaperDoc(input: {
  docId: string
}): Promise<{ id: string }> {
  await deletePaper(input.docId)
  return { id: input.docId }
}

export async function linkPaperApplyCard(input: {
  docId: string
  applyCardId: string | null
}): Promise<PaperDoc> {
  const doc = await getPaper(input.docId)
  const kind = doc.kind === "letter" ? "letter" : "cv"
  if (input.applyCardId == null) {
    const jobs = await listJobs()
    for (const job of jobs) {
      if (job.cvDocId === input.docId) {
        await runCommand("job.unlinkPaper", { jobId: job.id, kind: "cv" })
      }
      if (job.letterDocId === input.docId) {
        await runCommand("job.unlinkPaper", { jobId: job.id, kind: "letter" })
      }
    }
  } else {
    await linkJobPaper({
      jobId: input.applyCardId,
      docId: input.docId,
      kind,
    })
  }
  const next = asPaperDoc(await getPaper(input.docId))
  return { ...next, applyCardId: input.applyCardId }
}

export function upsertPaperDoc(docs: PaperDoc[], next: PaperDoc): PaperDoc[] {
  return [next, ...docs.filter((doc) => doc.id !== next.id)]
}

export function createKindLabel(kind: PaperContentKind) {
  return kind === "cv" ? "CV" : kind === "letter" ? "Letter" : "Proof"
}
