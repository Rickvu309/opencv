import type { CoachMode } from "@workspace/domain"

import { apiBaseUrl, apiFetch, apiStream } from "@/lib/api.ts"
import { runCommand } from "@/lib/api-envelope.ts"

import type {
  CoachAttachment,
  CoachListItem,
  CoachUiMessage,
  CoachUiPart,
  CoachUsageView,
} from "./coach-model.ts"

type Envelope<T> = { ok: true; data: T }

async function readData<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await apiFetch<Envelope<T> | T>(path, init)
  if (
    body &&
    typeof body === "object" &&
    "ok" in body &&
    (body as Envelope<T>).ok === true &&
    "data" in body
  ) {
    return (body as Envelope<T>).data
  }
  return body as T
}

type ServerMessage = {
  id: string
  role: string
  text?: string
  parts?: unknown[]
  status?: CoachUiMessage["status"]
  workedMs?: number | null
}

export type ServerChat = {
  id: string
  title?: string
  focusKind?: string | null
  focusId?: string | null
  updatedAt?: string
  messages?: ServerMessage[]
}

function textField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : ""
}

function recordOf(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function docNameOf(detail: Record<string, unknown> | null) {
  if (!detail) return ""
  if (detail.type === "paper.updateContent") return textField(detail.docName)
  if (detail.type === "paper.createDoc") return textField(detail.name)
  return textField(detail.docName)
}

function docIdOf(
  row: Record<string, unknown>,
  detail: Record<string, unknown> | null
) {
  const direct = textField(row.docId) || textField(detail?.docId)
  if (direct) return direct
  const result = recordOf(row.result)
  const data = recordOf(result?.data) ?? result
  const fromResult = textField(data?.id) || textField(data?.docId)
  if (fromResult) return fromResult
  const reversal = recordOf(row.reversal)
  const input = recordOf(reversal?.input)
  return textField(input?.docId)
}

export function partFromCoachEvent(
  event: string,
  data: unknown
): CoachUiPart | null {
  const row = recordOf(data) ?? {}
  if (event === "text" || event === "text-delta") {
    const value = textField(row.text)
    return value ? { kind: "text", text: value } : null
  }
  if (event === "step") {
    const label = textField(row.label)
    return label ? { kind: "step", label } : null
  }
  if (event === "confirm") {
    const pendingActionId = textField(row.pendingActionId)
    if (!pendingActionId) return null
    return {
      kind: "confirm",
      pendingActionId,
      command: textField(row.command),
      summary: textField(row.summary),
    }
  }
  if (event === "tool-result" || event === "tool" || event === "result") {
    return partFromToolResult(row)
  }
  return null
}

function partFromToolResult(row: Record<string, unknown>): CoachUiPart | null {
  const detail = recordOf(row.detail)
  const docName = docNameOf(detail)
  const docId = docIdOf(row, detail)
  const summary = textField(row.summary)
  const changes = typeof row.changes === "number" ? row.changes : undefined
  const activityId = textField(row.activityId)
  if (docName || docId || activityId || changes != null) {
    const toolName = textField(row.name) || textField(row.label)
    return {
      kind: "result",
      name: docName || toolName || "Document",
      summary,
      ...(activityId ? { activityId } : {}),
      ...(docId ? { docId } : {}),
      ...(changes != null ? { changes } : {}),
      ...(row.undone === true ? { undone: true } : {}),
    }
  }
  if (summary) return { kind: "step", label: summary }
  return null
}

export function resultFromApprove(row: unknown): CoachUiPart | null {
  const record = recordOf(row)
  if (!record) return null
  const detail = recordOf(record.detail)
  const output = recordOf(record.result)
  const name =
    textField(detail?.name) ||
    textField(detail?.docName) ||
    textField(output?.name)
  const docId =
    textField(detail?.docId) ||
    textField(output?.id) ||
    textField(record.subjectId)
  const activityId = textField(record.id)
  const changes =
    typeof detail?.changes === "number" ? detail.changes : undefined
  if (!name && !docId && !activityId && changes == null) return null
  return {
    kind: "result",
    name: name || "Document",
    summary: textField(record.summary),
    ...(activityId ? { activityId } : {}),
    ...(docId ? { docId } : {}),
    ...(changes != null ? { changes } : {}),
  }
}

function mapPart(part: unknown): CoachUiPart | null {
  if (!part || typeof part !== "object") return null
  const record = part as Record<string, unknown>
  const type = record.type ?? record.kind
  if (typeof type !== "string") return null
  return partFromCoachEvent(type, record)
}

export function messageFromServer(message: ServerMessage): CoachUiMessage {
  const mapped = (message.parts ?? [])
    .map(mapPart)
    .filter((part): part is CoachUiPart => part != null)
  if (mapped.length === 0 && message.text) {
    mapped.push({ kind: "text", text: message.text })
  }
  const role = message.role === "coach" ? "coach" : "person"
  return {
    id: message.id,
    role,
    parts: mapped,
    status: message.status ?? "final",
    ...(typeof message.workedMs === "number"
      ? { workedMs: message.workedMs }
      : {}),
  }
}

export function listChats(query?: string) {
  const path = query?.trim()
    ? `/api/chats?q=${encodeURIComponent(query.trim())}`
    : "/api/chats"
  return readData<CoachListItem[]>(path)
}

export function getChat(chatId: string) {
  return readData<ServerChat>(`/api/chats/${chatId}`)
}

export function createChat() {
  return runCommand<ServerChat>("chat.create", {})
}

export function setChatFocus(
  chatId: string,
  kind: "paper" | "job",
  id: string
) {
  return runCommand("chat.setFocus", {
    chatId,
    focus: { kind, id },
  })
}

export function stopChat(chatId: string) {
  return apiFetch(`/api/chats/${chatId}/stop`, {
    method: "POST",
    body: "{}",
  })
}

export function streamTurn(
  chatId: string,
  body: { text: string; attachments?: CoachAttachment[] },
  signal: AbortSignal
) {
  return apiStream(`/api/chats/${chatId}/turns`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  })
}

export function getCoachUsage() {
  return readData<CoachUsageView>("/api/coach/usage")
}

export function updateCoachMode(coachMode: CoachMode) {
  return runCommand("profile.update", { coachMode })
}

export function approveAction(pendingActionId: string) {
  return runCommand("actions.approve", { pendingActionId })
}

export function denyAction(pendingActionId: string) {
  return runCommand("actions.deny", { pendingActionId })
}

export function undoActivity(activityId: string) {
  return runCommand("activity.undo", { activityId })
}

export function sharePaper(docId: string) {
  return runCommand<{ url?: string }>("paper.share", { docId })
}

export async function importPaperFile(file: File) {
  const body = new FormData()
  body.set("file", file)
  const res = await fetch(new URL("/api/paper/import", apiBaseUrl), {
    method: "POST",
    credentials: "include",
    body,
  })
  if (!res.ok) {
    const error = new Error("Import failed")
    ;(error as Error & { status?: number }).status = res.status
    throw error
  }
  return res.json() as Promise<unknown>
}

export function listPaperDocs() {
  return readData<Array<{ id: string; name: string; updatedAt?: string }>>(
    "/api/paper"
  )
}

export function listJobs() {
  return readData<Array<{ id: string; title: string; company: string }>>(
    "/api/jobs"
  )
}
