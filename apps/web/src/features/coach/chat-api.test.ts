import {
  CHAT_TITLE_MAX,
  DEFAULT_CHAT_TITLE,
  LEGACY_CHAT_TITLE,
  type ChatRecord,
  type ChatSummary,
} from "@workspace/domain"
import { COACH_SSE_EVENTS } from "@/test/chat-api-mock.ts"
import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { undoActivity } from "@/lib/contract-client.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"
import {
  chatDetailKey,
  createChat,
  deleteChat,
  getChatByFocusDoc,
  listChats,
  streamCoachRegenerate,
  streamCoachTurn,
  toListItem,
  upsertChatSummary,
} from "@/features/coach/chat-api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

it("builds a detail key from a plain string before the query is enabled", () => {
  expect(chatDetailKey("not-a-parsed-id")).toEqual([
    "chat.get",
    { chatId: "not-a-parsed-id" },
  ])
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

describe("chat API client", () => {
  it("lists chats from GET /api/chats and maps them to Chats", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        envelope([
          chatRow(),
          chatRow({ id: "b", focusKind: "paper", focusId: DOC_ID }),
        ])
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(listChats()).resolves.toEqual([
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

  it("creates a chat with chat.create", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope(chatRow({ title: "Help me plan the week" })))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createChat(new QueryClient(), { title: "Help me plan the week" })
    ).resolves.toMatchObject({ id: CHAT_ID, title: "Help me plan the week" })

    const call = callOf(fetchMock)
    expect(call.url).toBe(`${apiBaseUrl}/api/commands/chat.create`)
    expect(call.init.method).toBe("POST")
    expect(inputOf(call)).toEqual({ title: "Help me plan the week" })
  })

  it("creates a chat without focus or title as New chat", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope(chatRow({ title: DEFAULT_CHAT_TITLE })))
    vi.stubGlobal("fetch", fetchMock)

    await expect(createChat(new QueryClient(), {})).resolves.toMatchObject({
      id: CHAT_ID,
      title: "New chat",
    })

    const call = callOf(fetchMock)
    expect(call.url).toBe(`${apiBaseUrl}/api/commands/chat.create`)
    expect(call.init.method).toBe("POST")
    expect(inputOf(call)).toEqual({})
  })

  it("opens the Paper chat and names a fresh one", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        envelope(
          chatRow({
            title: DEFAULT_CHAT_TITLE,
            focusKind: "paper",
            focusId: DOC_ID,
          })
        )
      )
      .mockResolvedValueOnce(
        envelope(
          chatRow({ title: "PM track CV", focusKind: "paper", focusId: DOC_ID })
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createChat(new QueryClient(), {
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

  it("renames a Paper chat that carries the legacy title", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        envelope(
          chatRow({
            title: LEGACY_CHAT_TITLE,
            focusKind: "paper",
            focusId: DOC_ID,
          })
        )
      )
      .mockResolvedValueOnce(
        envelope(
          chatRow({ title: "PM track CV", focusKind: "paper", focusId: DOC_ID })
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createChat(new QueryClient(), {
        title: "PM track CV",
        focusDocId: DOC_ID,
      })
    ).resolves.toMatchObject({ title: "PM track CV", focusDocId: DOC_ID })

    expect(callOf(fetchMock, 1).url).toBe(
      `${apiBaseUrl}/api/commands/chat.rename`
    )
    expect(inputOf(callOf(fetchMock, 1))).toEqual({
      chatId: CHAT_ID,
      title: "PM track CV",
    })
  })

  it("clips long chat titles to CHAT_TITLE_MAX without trailing space", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        envelope(
          chatRow({
            title: DEFAULT_CHAT_TITLE,
            focusKind: "paper",
            focusId: DOC_ID,
          })
        )
      )
      .mockResolvedValueOnce(
        envelope(chatRow({ focusKind: "paper", focusId: DOC_ID }))
      )
    vi.stubGlobal("fetch", fetchMock)

    const longTitle = `About ${"a".repeat(194)} trailing   `
    await createChat(new QueryClient(), {
      title: longTitle,
      focusDocId: DOC_ID,
    })

    const renameInput = inputOf(callOf(fetchMock, 1))
    expect(renameInput.title.length).toBeLessThanOrEqual(CHAT_TITLE_MAX)
    expect(renameInput.title).toBe(`About ${"a".repeat(194)}`)
    expect(renameInput.title.endsWith(" ")).toBe(false)
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
      createChat(new QueryClient(), {
        title: "PM track CV",
        focusDocId: DOC_ID,
      })
    ).resolves.toMatchObject({ title: "Earlier talk" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("finds the Chat grounded on a doc from the chat list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        envelope([
          chatRow({ id: "other" }),
          chatRow({ focusKind: "paper", focusId: DOC_ID }),
        ])
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(getChatByFocusDoc(DOC_ID)).resolves.toMatchObject({
      id: CHAT_ID,
      focusDocId: DOC_ID,
    })
  })

  it("returns null when no Chat is grounded on the doc", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope([chatRow()])))
    await expect(getChatByFocusDoc(DOC_ID)).resolves.toBeNull()
  })

  it("deletes a chat with chat.delete", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: CHAT_ID }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(deleteChat(new QueryClient(), CHAT_ID)).resolves.toEqual({
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
      new QueryClient(),
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
    expect(onTextDelta).toHaveBeenCalledWith({
      type: "text-delta",
      text: "Hello",
    })
    expect(onMessageEnd).toHaveBeenCalledWith({
      type: "message-end",
      chatId: CHAT_ID,
    })
  })

  it("includes focusDocId on a Paper-scoped coach turn", async () => {
    const chatId = "11111111-1111-4111-8111-111111111111"
    const focusDocId = "11111111-1111-7111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `event: ${COACH_SSE_EVENTS.messageStart}`,
          `data: ${JSON.stringify({ chatId })}`,
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
      new QueryClient(),
      chatId,
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
    const chatId = "11111111-1111-4111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `event: ${COACH_SSE_EVENTS.messageStart}`,
          `data: ${JSON.stringify({ chatId })}`,
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
      new QueryClient(),
      chatId,
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
    const chatId = "11111111-1111-4111-8111-111111111111"
    const focusDocId = "11111111-1111-7111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `event: ${COACH_SSE_EVENTS.messageStart}`,
          `data: ${JSON.stringify({ chatId })}`,
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
      new QueryClient(),
      chatId,
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
    const chatId = "11111111-1111-4111-8111-111111111111"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `event: ${COACH_SSE_EVENTS.messageStart}`,
          `data: ${JSON.stringify({ chatId })}`,
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
    await streamCoachRegenerate(
      new QueryClient(),
      chatId,
      { onTextDelta },
      undefined,
      "max"
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ regenerate: true, mode: "max" }))
    expect(onTextDelta).toHaveBeenCalledWith({
      type: "text-delta",
      text: "Again",
    })
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

describe("chat list helpers", () => {
  it("moves an upserted Chat to the front", () => {
    const older: ChatSummary = {
      id: "a",
      title: "Older",
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      focusDocId: null,
    }
    const newer: ChatSummary = {
      id: "b",
      title: "Newer",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      focusDocId: null,
    }

    expect(upsertChatSummary([older], newer).map((chat) => chat.id)).toEqual([
      "b",
      "a",
    ])
    expect(
      upsertChatSummary([newer, older], { ...older, title: "Updated" }).map(
        (chat) => chat.title
      )
    ).toEqual(["Updated", "Newer"])
  })

  it("drops messages when projecting detail onto a list item", () => {
    const detail: ChatRecord = {
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
