import {
  THREAD_COMMANDS,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadsCreateInput,
  type ThreadsPostMessageInput,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"

export const threadQueryKeys = {
  all: ["threads"] as const,
  list: () => ["threads", "list"] as const,
  detail: (id: string) => ["threads", "detail", id] as const,
}

type SuccessBody<T> = {
  ok: true
  data: T
}

function unwrapData<T>(body: SuccessBody<T>): T {
  return body.data
}

async function runCommand<T>(name: string, input: unknown): Promise<T> {
  const body = await apiFetch<SuccessBody<T>>(`/api/commands/${name}`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return unwrapData(body)
}

export async function listThreads(): Promise<ThreadListItem[]> {
  const body = await apiFetch<SuccessBody<ThreadListItem[]>>("/api/threads")
  return unwrapData(body)
}

export async function getThread(id: string): Promise<ThreadDetail> {
  const body = await apiFetch<SuccessBody<ThreadDetail>>(`/api/threads/${id}`)
  return unwrapData(body)
}

export function createThread(
  input: ThreadsCreateInput = {}
): Promise<ThreadListItem> {
  return runCommand<ThreadListItem>(THREAD_COMMANDS.create, input)
}

export function postThreadMessage(
  input: ThreadsPostMessageInput
): Promise<ThreadDetail> {
  return runCommand<ThreadDetail>(THREAD_COMMANDS.postMessage, input)
}

export function upsertThreadListItem(
  threads: ThreadListItem[],
  item: ThreadListItem
): ThreadListItem[] {
  return [item, ...threads.filter((thread) => thread.id !== item.id)]
}

export function toListItem(detail: ThreadDetail): ThreadListItem {
  return {
    id: detail.id,
    title: detail.title,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  }
}
