import type { PaperId, PaperView, QueryOutput } from "@workspace/domain"

import { ApiError, apiFetch, apiStream } from "@/lib/api.ts"
import { runCommand, unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"
import { queryKey } from "@/lib/contract-client.ts"
import { readSseStream } from "@/lib/sse.ts"

export const paperListKey = () => queryKey({ query: "paper.list" })
export const paperGetKey = (docId: PaperId) =>
  queryKey({ query: "paper.get", input: { docId } })
export const paperPagesKey = (docId: PaperId) =>
  queryKey({ query: "paper.pageCount", input: { docId } })
export const paperFilesKey = () => queryKey({ query: "paper.files" })
export const paperSharedKey = (token: string) =>
  queryKey({ query: "paper.shared", input: { token } })

export function listPaper() {
  return apiFetch<SuccessBody<QueryOutput<"paper.list">>>("/api/paper").then(
    unwrapData
  )
}

export function getPaper(docId: string) {
  return apiFetch<SuccessBody<QueryOutput<"paper.get">>>(
    `/api/paper/${docId}`
  ).then(unwrapData)
}

export function listPaperFiles() {
  return apiFetch<SuccessBody<QueryOutput<"paper.files">>>(
    "/api/paper/files"
  ).then(unwrapData)
}

export function getPaperPages(docId: string) {
  return apiFetch<SuccessBody<QueryOutput<"paper.pageCount">>>(
    `/api/paper/${docId}/pages`
  ).then(unwrapData)
}

export function getSharedPaper(token: string) {
  return apiFetch<SuccessBody<QueryOutput<"paper.shared">>>(
    `/api/paper/shared/${token}`
  ).then(unwrapData)
}

export class PaperLimitError extends Error {
  readonly resetsAt: string | null

  constructor(message: string, resetsAt: string | null) {
    super(message)
    this.name = "PaperLimitError"
    this.resetsAt = resetsAt
  }
}

export async function importPaperFile(file: File): Promise<PaperView> {
  const body = new FormData()
  body.set("file", file)
  const res = await fetch(new URL("/api/paper/import", apiBaseUrl), {
    method: "POST",
    credentials: "include",
    body,
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
  const payload = (await res.json()) as SuccessBody<PaperView>
  return unwrapData(payload)
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
