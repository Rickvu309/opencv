import {
  COACH_SSE_EVENTS,
  type ThreadDetail,
  type ThreadListItem,
} from "@workspace/domain"
import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { undoActivity } from "@/lib/contract-client.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"
import {
  createThread,
  deleteThread,
  getThread,
  getThreadByFocusDoc,
  listThreads,
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

const CHAT_ID = "11111111-1111-4111-8111-111111111111"
const DOC_ID = "11111111-1111-7111-8111-111111111111"
const ACTIVITY_ID = "55555555-5555-4555-8555-555555555555"
const STAMP = "2026-08-25T00:00:00.000Z"

function chatRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CHAT_ID,
    title: "Plan the week",
    focusKind: null,
    focusId: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  }
}

function inputOf(call: { init: RequestInit }) {
  return JSON.parse(String(call.init.body)).input
}

function callOf(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return { url: String(url), init }
}

describe("thread API client", () => {
  it("lists chats from GET /api/chats and maps them to Threads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        envelope([
          chatRow(),
          chatRow({ id: "b", focusKind: "paper", focusId: DOC_ID }),
        ])
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(listThreads()).resolves.toEqual([
      {
        id: CHAT_ID,
        title: "Plan the week",
        createdAt: STAMP,
        updatedAt: STAMP,
        focusDocId: null,
      },
      {
        id: "b",
        title: "Plan the week",
        createdAt: STAMP,
        updatedAt: STAMP,
        focusDocId: DOC_ID,
      },
    ])
    const { url, init } = callOf(fetchMock)
    expect(url).toBe(`${apiBaseUrl}/api/chats`)
    expect(init.credentials).toBe("include")
  })

  it("reads chat detail and maps person messages to user, dropping attachments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      envelope({
        ...chatRow(),
        messages: [
          {
            id: "m1",
            role: "person",
            text: "Help",
            createdAt: STAMP,
            parts: [
              { type: "text", text: "Help" },
              { type: "attachment", name: "cv.pdf" },
            ],
            status: "final",
            workedMs: null,
          },
          {
            id: "m2",
            role: "coach",
            text: "Done",
            createdAt: STAMP,
            parts: [{ type: "text", text: "Done" }],
            status: "final",
            workedMs: 900,
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const detail = await getThread(CHAT_ID)
    expect(callOf(fetchMock).url).toBe(`${apiBaseUrl}/api/chats/${CHAT_ID}`)
    expect(detail.messages).toEqual([
      {
        id: "m1",
        role: "user",
        text: "Help",
        createdAt: STAMP,
        parts: [{ type: "text", text: "Help" }],
        status: "final",
      },
      {
        id: "m2",
        role: "coach",
        text: "Done",
        createdAt: STAMP,
        parts: [{ type: "text", text: "Done" }],
        status: "final",
        workedMs: 900,
      },
    ])
  })

  it("creates a chat with chat.create", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope(chatRow({ title: "Help me plan the week" })))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createThread(new QueryClient(), { title: "Help me plan the week" })
    ).resolves.toMatchObject({ id: CHAT_ID, title: "Help me plan the week" })

    const call = callOf(fetchMock)
    expect(call.url).toBe(`${apiBaseUrl}/api/commands/chat.create`)
    expect(call.init.method).toBe("POST")
    expect(inputOf(call)).toEqual({ title: "Help me plan the week" })
  })

  it("opens the Paper chat and names a fresh one", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        envelope(
          chatRow({ title: "New Thread", focusKind: "paper", focusId: DOC_ID })
        )
      )
      .mockResolvedValueOnce(
        envelope(
          chatRow({ title: "PM track CV", focusKind: "paper", focusId: DOC_ID })
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createThread(new QueryClient(), {
        title: "PM track CV",
        focusDocId: DOC_ID,
      })
    ).resolves.toMatchObject({ title: "PM track CV", focusDocId: DOC_ID })

    expect(callOf(fetchMock, 0).url).toBe(
      `${apiBaseUrl}/api/commands/chat.open`
    )
    expect(inputOf(callOf(fetchMock, 0))).toEqual({
      focus: { kind: "paper", id: DOC_ID },
    })
    expect(callOf(fetchMock, 1).url).toBe(
      `${apiBaseUrl}/api/commands/chat.rename`
    )
    expect(inputOf(callOf(fetchMock, 1))).toEqual({
      chatId: CHAT_ID,
      title: "PM track CV",
    })
  })

  it("keeps the title of a reused Paper chat", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      envelope(
        chatRow({
          title: "Earlier talk",
          focusKind: "paper",
          focusId: DOC_ID,
        })
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createThread(new QueryClient(), {
        title: "PM track CV",
        focusDocId: DOC_ID,
      })
    ).resolves.toMatchObject({ title: "Earlier talk" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("finds the Thread grounded on a doc from the chat list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        envelope([
          chatRow({ id: "other" }),
          chatRow({ focusKind: "paper", focusId: DOC_ID }),
        ])
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(getThreadByFocusDoc(DOC_ID)).resolves.toMatchObject({
      id: CHAT_ID,
      focusDocId: DOC_ID,
    })
  })

  it("returns null when no Thread is grounded on the doc", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope([chatRow()])))
    await expect(getThreadByFocusDoc(DOC_ID)).resolves.toBeNull()
  })

  it("deletes a chat with chat.delete", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: CHAT_ID }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(deleteThread(new QueryClient(), CHAT_ID)).resolves.toEqual({
      id: CHAT_ID,
    })
    const call = callOf(fetchMock)
    expect(call.url).toBe(`${apiBaseUrl}/api/commands/chat.delete`)
    expect(inputOf(call)).toEqual({ chatId: CHAT_ID })
  })

  it("streams a Coach turn from POST /api/chats/:id/turns", async () => {
    const body = [
      `event: ${COACH_SSE_EVENTS.messageStart}`,
      `data: ${JSON.stringify({ chatId: CHAT_ID })}`,
      "",
      `event: ${COACH_SSE_EVENTS.textDelta}`,
      `data: ${JSON.stringify({ text: "Hello" })}`,
      "",
      `event: ${COACH_SSE_EVENTS.messageEnd}`,
      `data: ${JSON.stringify({ chatId: CHAT_ID })}`,
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
      CHAT_ID,
      "Help me plan the week",
      { onTextDelta, onMessageEnd },
      undefined,
      "light"
    )

    const { url, init } = callOf(fetchMock)
    expect(url).toBe(`${apiBaseUrl}/api/chats/${CHAT_ID}/turns`)
    expect(init.method).toBe("POST")
    expect(init.body).toBe(
      JSON.stringify({ text: "Help me plan the week", mode: "light" })
    )
    expect(onTextDelta).toHaveBeenCalledWith({ text: "Hello" })
    expect(onMessageEnd).toHaveBeenCalledWith({ chatId: CHAT_ID })
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

  it("undoes a receipt with activity.undo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ activityId: "a1" }))
    vi.stubGlobal("fetch", fetchMock)

    await undoActivity(new QueryClient(), ACTIVITY_ID)
    const call = callOf(fetchMock)
    expect(call.url).toBe(`${apiBaseUrl}/api/commands/activity.undo`)
    expect(call.init.method).toBe("POST")
    expect(inputOf(call)).toEqual({ activityId: ACTIVITY_ID })
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
