import type { QueryClient } from "@tanstack/react-query"
import type {
  ChatToolName,
  PaperId,
  PaperView,
  QueryOutput,
} from "@workspace/domain"

import { ApiError, apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { queryKey } from "@/lib/contract-client.ts"
import { streamChatTurn } from "@/lib/coach-stream.ts"
import { endpoints, fetchBinary } from "@/lib/requests.ts"

export const paperListKey = () => queryKey({ query: "paper.list" })
export const paperGetKey = (docId: PaperId) =>
  queryKey({ query: "paper.get", input: { docId } })
export const paperPagesKey = (docId: PaperId) =>
  queryKey({ query: "paper.pageCount", input: { docId } })
export const paperFilesKey = () => queryKey({ query: "paper.files" })
export const paperSharedKey = (token: string) =>
  queryKey({ query: "paper.shared", input: { token } })

export function listPaper() {
  return apiFetch<SuccessBody<QueryOutput<"paper.list">>>(endpoints.paper).then(
    unwrapData
  )
}

export function getPaper(docId: string) {
  return apiFetch<SuccessBody<QueryOutput<"paper.get">>>(
    endpoints.paperDoc(docId)
  ).then(unwrapData)
}

export function listPaperFiles() {
  return apiFetch<SuccessBody<QueryOutput<"paper.files">>>(
    endpoints.paperFiles
  ).then(unwrapData)
}

export function getPaperPages(docId: string) {
  return apiFetch<SuccessBody<QueryOutput<"paper.pageCount">>>(
    endpoints.paperPages(docId)
  ).then(unwrapData)
}

export function getSharedPaper(token: string) {
  return apiFetch<SuccessBody<QueryOutput<"paper.shared">>>(
    endpoints.paperShared(token)
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
  const res = await fetchBinary(endpoints.paperImport, {
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

export function stopPaperChat(chatId: string): Promise<void> {
  return apiFetch(endpoints.chatStop(chatId), { method: "POST" })
}

export async function streamPaperTurn(input: {
  queryClient: QueryClient
  chatId: string
  text: string
  focusDocId: string
  context?: { kind: "paper" | "job" | "link" | "file"; id: string }[]
  signal?: AbortSignal
  onText: (delta: string) => void
  onToolResult: (tool: ChatToolName) => void
}): Promise<void> {
  try {
    await streamChatTurn({
      queryClient: input.queryClient,
      chatId: input.chatId,
      body: {
        text: input.text,
        focusDocId: input.focusDocId,
        ...(input.context ? { context: input.context } : {}),
      },
      signal: input.signal,
      onEvent(event) {
        if (event.type === "text-delta") input.onText(event.text)
        if (event.type === "tool-result") input.onToolResult(event.name)
        if (event.type === "error") {
          throw new ApiError(502, "REQUEST_FAILED", event.message)
        }
      },
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      const usage = await apiFetch<SuccessBody<{ resetsAt?: string }>>(
        endpoints.coachUsage
      ).catch(() => null)
      throw new PaperLimitError(
        error.message,
        usage ? (unwrapData(usage).resetsAt ?? null) : null
      )
    }
    throw error
  }
}

export async function latestActivityId(
  subjectId: string
): Promise<string | null> {
  const body = await apiFetch<SuccessBody<QueryOutput<"activity.list">>>(
    endpoints.activityOfSubject(subjectId)
  )
  return unwrapData(body)[0]?.id ?? null
}
