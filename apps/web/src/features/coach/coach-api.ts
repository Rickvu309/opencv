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

function mapPart(part: unknown): CoachUiPart | null {
  if (!part || typeof part !== "object") return null
  const record = part as Record<string, unknown>
  const type = record.type ?? record.kind
  if (type === "text" || type === "text-delta") {
    return typeof record.text === "string" && record.text
      ? { kind: "text", text: record.text }
      : null
  }
  if (type === "step" && typeof record.label === "string") {
    return { kind: "step", label: record.label }
  }
  if (
    type === "confirm" &&
    typeof record.pendingActionId === "string" &&
    typeof record.command === "string"
  ) {
    return {
      kind: "confirm",
      pendingActionId: record.pendingActionId,
      command: record.command,
      summary: typeof record.summary === "string" ? record.summary : "",
    }
  }
  if (type === "tool-result" || type === "tool" || type === "result") {
    const name =
      typeof record.name === "string"
        ? record.name
        : typeof record.label === "string"
          ? record.label
          : "Document"
    const summary = typeof record.summary === "string" ? record.summary : ""
    const changes =
      typeof record.changes === "number" ? record.changes : undefined
    if (record.activityId || record.docId || changes != null) {
      return {
        kind: "result",
        ...(typeof record.activityId === "string"
          ? { activityId: record.activityId }
          : {}),
        name,
        summary,
        ...(changes != null ? { changes } : {}),
        ...(typeof record.docId === "string" ? { docId: record.docId } : {}),
        ...(record.undone === true ? { undone: true } : {}),
      }
    }
    if (summary) return { kind: "step", label: summary }
  }
  return null
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

export function setChatFocus(chatId: string, kind: "paper" | "job", id: string) {
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
