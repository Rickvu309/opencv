import { afterEach, describe, expect, it, vi } from "vitest"

import { getChat } from "@/features/coach/chat-api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

const CHAT_ID = "11111111-1111-4111-8111-111111111111"
const TASK_ID = "22222222-2222-4222-8222-222222222222"
const STAMP = "2026-08-25T00:00:00.000Z"
const PLACEHOLDER =
  "Coach is still working. Reload this Chat to follow or stop it."

function detail(activeTaskId: string | null) {
  return {
    id: CHAT_ID,
    title: "Plan the week",
    focusKind: null,
    focusId: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    activeTaskId,
    messages: [
      {
        id: "m1",
        chatId: CHAT_ID,
        role: "person",
        text: "What next?",
        createdAt: STAMP,
        parts: [{ type: "text", text: "What next?" }],
        status: "final",
        workedMs: null,
      },
      {
        id: TASK_ID,
        chatId: CHAT_ID,
        role: "coach",
        text: PLACEHOLDER,
        createdAt: STAMP,
        parts: [{ type: "text", text: PLACEHOLDER }],
        status: null,
        workedMs: null,
      },
    ],
  }
}

function serve(activeTaskId: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(Response.json({ ok: true, data: detail(activeTaskId) }))
    )
  )
}

describe("chat detail while Coach is working", () => {
  it("leaves out the reload notice that stands in for the running task", async () => {
    serve(TASK_ID)
    const chat = await getChat(CHAT_ID)
    expect(chat.activeTaskId).toBe(TASK_ID)
    expect(chat.messages.map((message) => message.id)).toEqual(["m1"])
  })

  it("keeps every message when no task is running", async () => {
    serve(null)
    const chat = await getChat(CHAT_ID)
    expect(chat.messages.map((message) => message.id)).toEqual(["m1", TASK_ID])
  })
})
