import {
  THREAD_COMMANDS,
  type ThreadDetail,
  type ThreadListItem,
} from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"
import {
  createThread,
  getThread,
  listThreads,
  postThreadMessage,
  toListItem,
  upsertThreadListItem,
} from "@/features/home/thread-api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

function envelope<T>(data: T) {
  return Response.json({ ok: true, data })
}

describe("thread API client", () => {
  it("lists Threads from GET /api/threads and unwraps the envelope", async () => {
    const threads: ThreadListItem[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Plan the week",
        createdAt: "2026-08-25T00:00:00.000Z",
        updatedAt: "2026-08-25T00:00:00.000Z",
      },
    ]
    const fetchMock = vi.fn().mockResolvedValue(envelope(threads))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listThreads()).resolves.toEqual(threads)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/threads`
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.credentials).toBe("include")
  })

  it("reads Thread detail from GET /api/threads/:id", async () => {
    const detail: ThreadDetail = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Plan the week",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          text: "Help",
          createdAt: "2026-08-25T00:00:00.000Z",
        },
      ],
    }
    const fetchMock = vi.fn().mockResolvedValue(envelope(detail))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getThread(detail.id)).resolves.toEqual(detail)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/threads/${detail.id}`
    )
  })

  it("creates a Thread through the Command registry", async () => {
    const created: ThreadListItem = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Help me plan the week",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    }
    const fetchMock = vi.fn().mockResolvedValue(envelope(created))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createThread({ title: "Help me plan the week" })
    ).resolves.toEqual(created)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/${THREAD_COMMANDS.create}`
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ title: "Help me plan the week" }))
  })

  it("posts a message through the Command registry", async () => {
    const detail: ThreadDetail = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Help me plan the week",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          text: "Help me plan the week",
          createdAt: "2026-08-25T00:00:00.000Z",
        },
        {
          id: "m2",
          role: "coach",
          text: "I hear you.",
          createdAt: "2026-08-25T00:00:01.000Z",
        },
      ],
    }
    const fetchMock = vi.fn().mockResolvedValue(envelope(detail))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      postThreadMessage({
        threadId: detail.id,
        text: "Help me plan the week",
      })
    ).resolves.toEqual(detail)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/${THREAD_COMMANDS.postMessage}`
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(init.body).toBe(
      JSON.stringify({
        threadId: detail.id,
        text: "Help me plan the week",
      })
    )
  })
})

describe("thread list helpers", () => {
  it("moves an upserted Thread to the front", () => {
    const older: ThreadListItem = {
      id: "a",
      title: "Older",
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    }
    const newer: ThreadListItem = {
      id: "b",
      title: "Newer",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    }

    expect(
      upsertThreadListItem([older], newer).map((thread) => thread.id)
    ).toEqual(["b", "a"])
    expect(
      upsertThreadListItem([newer, older], { ...older, title: "Updated" }).map(
        (thread) => thread.title
      )
    ).toEqual(["Updated", "Newer"])
  })

  it("drops messages when projecting detail onto a list item", () => {
    const detail: ThreadDetail = {
      id: "a",
      title: "Plan",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          text: "Hi",
          createdAt: "2026-08-25T00:00:00.000Z",
        },
      ],
    }

    expect(toListItem(detail)).toEqual({
      id: "a",
      title: "Plan",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })
  })
})
