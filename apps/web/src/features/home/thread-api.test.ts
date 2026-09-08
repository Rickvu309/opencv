import {
  COACH_SSE_EVENTS,
  THREAD_COMMANDS,
  type ThreadDetail,
  type ThreadListItem,
} from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"
import {
  createThread,
  deleteThread,
  getThread,
  getThreadByFocusDoc,
  listThreads,
  postThreadMessage,
  rateCoachMessage,
  reverseCoachReceipt,
  streamCoachRegenerate,
  streamCoachTurn,
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
        focusDocId: null,
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
      focusDocId: null,
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
      focusDocId: null,
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

  it("creates a Paper-grounded Thread with focusDocId", async () => {
    const focusDocId = "11111111-1111-7111-8111-111111111111"
    const created: ThreadListItem = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "PM track CV",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      focusDocId,
    }
    const fetchMock = vi.fn().mockResolvedValue(envelope(created))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createThread({ title: "PM track CV", focusDocId })
    ).resolves.toEqual(created)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(
      JSON.stringify({ title: "PM track CV", focusDocId })
    )
  })

  it("reads the latest Thread for a focusDocId", async () => {
    const focusDocId = "11111111-1111-7111-8111-111111111111"
    const thread: ThreadListItem = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "PM track CV",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      focusDocId,
    }
    const fetchMock = vi.fn().mockResolvedValue(envelope(thread))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getThreadByFocusDoc(focusDocId)).resolves.toEqual(thread)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/threads?focusDocId=${focusDocId}`
    )
  })

  it("returns null when no Thread is grounded on the doc", async () => {
    const focusDocId = "11111111-1111-7111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(envelope(null))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getThreadByFocusDoc(focusDocId)).resolves.toBeNull()
  })

  it("deletes a Thread through the Command registry", async () => {
    const deleted = { id: "11111111-1111-4111-8111-111111111111" }
    const fetchMock = vi.fn().mockResolvedValue(envelope(deleted))
    vi.stubGlobal("fetch", fetchMock)

    await expect(deleteThread({ threadId: deleted.id })).resolves.toEqual(
      deleted
    )

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/${THREAD_COMMANDS.delete}`
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ threadId: deleted.id }))
  })

  it("posts a message through the Command registry", async () => {
    const detail: ThreadDetail = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Help me plan the week",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      focusDocId: null,
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

  it("streams a Coach turn from POST /api/threads/:id/coach", async () => {
    const threadId = "11111111-1111-4111-8111-111111111111"
    const body = [
      `event: ${COACH_SSE_EVENTS.messageStart}`,
      `data: ${JSON.stringify({ threadId })}`,
      "",
      `event: ${COACH_SSE_EVENTS.textDelta}`,
      `data: ${JSON.stringify({ text: "Hello" })}`,
      "",
      `event: ${COACH_SSE_EVENTS.messageEnd}`,
      `data: ${JSON.stringify({
        message: {
          id: "c1",
          role: "coach",
          text: "Hello",
          createdAt: "2026-08-25T00:00:01.000Z",
          workedMs: 1100,
          status: "final",
        },
        usage: { model: "mock" },
      })}`,
      "",
    ].join("\n")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const onTextDelta = vi.fn()
    const onMessageEnd = vi.fn()
    await streamCoachTurn(
      threadId,
      "Help me plan the week",
      {
        onTextDelta,
        onMessageEnd,
      },
      undefined,
      "light"
    )

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/threads/${threadId}/coach`
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(init.body).toBe(
      JSON.stringify({ text: "Help me plan the week", mode: "light" })
    )
    expect(onTextDelta).toHaveBeenCalledWith({ text: "Hello" })
    expect(onMessageEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ text: "Hello", workedMs: 1100 }),
      })
    )
  })

  it("includes focusDocId on a Paper-scoped coach turn", async () => {
    const threadId = "11111111-1111-4111-8111-111111111111"
    const focusDocId = "11111111-1111-7111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `event: ${COACH_SSE_EVENTS.messageStart}`,
          `data: ${JSON.stringify({ threadId })}`,
          "",
          `event: ${COACH_SSE_EVENTS.messageEnd}`,
          `data: ${JSON.stringify({
            message: {
              id: "c1",
              role: "coach",
              text: "",
              createdAt: "2026-08-25T00:00:01.000Z",
              status: "final",
            },
            usage: { model: "mock" },
          })}`,
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await streamCoachTurn(
      threadId,
      "Sharpen this bullet",
      {},
      undefined,
      "free",
      focusDocId
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(
      JSON.stringify({
        text: "Sharpen this bullet",
        mode: "free",
        focusDocId,
      })
    )
  })

  it("sends focusDocId null when Paper soft-scope was cleared", async () => {
    const threadId = "11111111-1111-4111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `event: ${COACH_SSE_EVENTS.messageStart}`,
          `data: ${JSON.stringify({ threadId })}`,
          "",
          `event: ${COACH_SSE_EVENTS.messageEnd}`,
          `data: ${JSON.stringify({
            message: {
              id: "c1",
              role: "coach",
              text: "",
              createdAt: "2026-08-25T00:00:01.000Z",
              status: "final",
            },
            usage: { model: "mock" },
          })}`,
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await streamCoachTurn(
      threadId,
      "What should I cut?",
      {},
      undefined,
      "free",
      null
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(
      JSON.stringify({
        text: "What should I cut?",
        mode: "free",
        focusDocId: null,
      })
    )
  })

  it("includes selection on a Paper-scoped coach turn", async () => {
    const threadId = "11111111-1111-4111-8111-111111111111"
    const focusDocId = "11111111-1111-7111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `event: ${COACH_SSE_EVENTS.messageStart}`,
          `data: ${JSON.stringify({ threadId })}`,
          "",
          `event: ${COACH_SSE_EVENTS.messageEnd}`,
          `data: ${JSON.stringify({
            message: {
              id: "c1",
              role: "coach",
              text: "",
              createdAt: "2026-08-25T00:00:01.000Z",
              status: "final",
            },
            usage: { model: "mock" },
          })}`,
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await streamCoachTurn(
      threadId,
      "Rewrite selection",
      {},
      undefined,
      "free",
      focusDocId,
      { text: "old bullet", sectionId: "summary" }
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(
      JSON.stringify({
        text: "Rewrite selection",
        mode: "free",
        focusDocId,
        selection: { text: "old bullet", sectionId: "summary" },
      })
    )
  })

  it("streams a regenerate turn without posting user text", async () => {
    const threadId = "11111111-1111-4111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `event: ${COACH_SSE_EVENTS.messageStart}`,
          `data: ${JSON.stringify({ threadId })}`,
          "",
          `event: ${COACH_SSE_EVENTS.textDelta}`,
          `data: ${JSON.stringify({ text: "Again" })}`,
          "",
          `event: ${COACH_SSE_EVENTS.messageEnd}`,
          `data: ${JSON.stringify({
            message: {
              id: "c2",
              role: "coach",
              text: "Again",
              createdAt: "2026-08-25T00:00:02.000Z",
              status: "final",
            },
            usage: { model: "mock", mode: "max" },
          })}`,
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const onTextDelta = vi.fn()
    await streamCoachRegenerate(threadId, { onTextDelta }, undefined, "max")

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ regenerate: true, mode: "max" }))
    expect(onTextDelta).toHaveBeenCalledWith({ text: "Again" })
  })

  it("records a rating through POST /api/threads/:id/messages/:messageId/feedback", async () => {
    const threadId = "11111111-1111-4111-8111-111111111111"
    const messageId = "22222222-2222-4222-8222-222222222222"
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope({ messageId, rating: "up" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(rateCoachMessage(threadId, messageId, "up")).resolves.toEqual({
      messageId,
      rating: "up",
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/threads/${threadId}/messages/${messageId}/feedback`
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ rating: "up" }))
  })

  it("reverses a receipt through POST /api/threads/:id/messages/:messageId/reverse", async () => {
    const threadId = "11111111-1111-4111-8111-111111111111"
    const messageId = "22222222-2222-4222-8222-222222222222"
    const receipt = {
      type: "tool" as const,
      name: "apply_deleteCard",
      summary: "Deleted the card",
      ok: true,
      toolCallId: "undo-1",
    }
    const thread = {
      id: threadId,
      title: "Plan",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:01.000Z",
      focusDocId: null,
      messages: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(envelope({ thread, receipt }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      reverseCoachReceipt(threadId, messageId, "call_1")
    ).resolves.toEqual({ thread, receipt })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/threads/${threadId}/messages/${messageId}/reverse`
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ toolCallId: "call_1" }))
  })
})

describe("thread list helpers", () => {
  it("moves an upserted Thread to the front", () => {
    const older: ThreadListItem = {
      id: "a",
      title: "Older",
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      focusDocId: null,
    }
    const newer: ThreadListItem = {
      id: "b",
      title: "Newer",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      focusDocId: null,
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
      focusDocId: null,
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
      focusDocId: null,
    })
  })
})
