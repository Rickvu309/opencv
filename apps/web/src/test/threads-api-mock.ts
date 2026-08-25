import {
  DEFAULT_THREAD_TITLE,
  THREAD_COMMANDS,
  type ThreadDetail,
  type ThreadListItem,
} from "@workspace/domain"
import { vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"

import { FIXTURE_THREADS } from "./thread-fixtures.ts"

type Store = {
  threads: ThreadDetail[]
}

const store: Store = {
  threads: cloneThreads(FIXTURE_THREADS),
}

function cloneThreads(threads: ThreadDetail[]): ThreadDetail[] {
  return structuredClone(threads)
}

function isoNow() {
  return new Date().toISOString()
}

function pathOf(input: RequestInfo | URL) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  return new URL(raw, apiBaseUrl).pathname
}

function jsonOk<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status })
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

function listItems(): ThreadListItem[] {
  return [...store.threads]
    .sort((a, b) => {
      const byUpdated = b.updatedAt.localeCompare(a.updatedAt)
      if (byUpdated !== 0) return byUpdated
      return b.id.localeCompare(a.id)
    })
    .map(({ id, title, createdAt, updatedAt }) => ({
      id,
      title,
      createdAt,
      updatedAt,
    }))
}

async function readBody(init?: RequestInit): Promise<unknown> {
  if (init?.body == null) return {}
  const text = String(init.body)
  if (text.trim() === "") return {}
  return JSON.parse(text) as unknown
}

export function resetThreadApiMock() {
  store.threads = cloneThreads(FIXTURE_THREADS)
}

export function getMockThreads() {
  return store.threads
}

export async function threadApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()

  if (method === "GET" && path === "/api/threads") {
    return jsonOk(listItems())
  }

  const detail = /^\/api\/threads\/([^/]+)$/.exec(path)
  if (method === "GET" && detail) {
    const thread = store.threads.find((item) => item.id === detail[1])
    if (!thread) {
      return jsonError(404, "NOT_FOUND", "Thread not found")
    }
    return jsonOk(thread)
  }

  if (method === "POST" && path === `/api/commands/${THREAD_COMMANDS.create}`) {
    const body = (await readBody(init)) as { title?: string }
    const now = isoNow()
    const created: ThreadDetail = {
      id: crypto.randomUUID(),
      title: body.title?.trim() || DEFAULT_THREAD_TITLE,
      createdAt: now,
      updatedAt: now,
      messages: [],
    }
    store.threads.unshift(created)
    return jsonOk({
      id: created.id,
      title: created.title,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    })
  }

  if (
    method === "POST" &&
    path === `/api/commands/${THREAD_COMMANDS.postMessage}`
  ) {
    const body = (await readBody(init)) as { threadId?: string; text?: string }
    const thread = store.threads.find((item) => item.id === body.threadId)
    if (!thread) {
      return jsonError(404, "NOT_FOUND", "Thread not found")
    }
    const now = isoNow()
    thread.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      text: body.text ?? "",
      createdAt: now,
    })
    thread.updatedAt = now
    return jsonOk(thread)
  }

  throw new Error(`Unexpected fetch: ${method} ${path}`)
}

export function installThreadApiMock() {
  vi.stubGlobal("fetch", threadApiFetch)
}
