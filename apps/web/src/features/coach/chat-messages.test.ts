import { describe, expect, it } from "vitest"

import {
  DEFAULT_CHAT_TITLE,
  LEGACY_CHAT_TITLE,
  chatDisplayTitle,
  titleFrom,
} from "@workspace/domain/coach"

import {
  STREAMING_COACH_ID,
  latestCoachMessageId,
  toChatViewMessages,
} from "@/features/coach/chat-messages.ts"

describe("chatDisplayTitle", () => {
  it("renders untitled chats, DEFAULT_CHAT_TITLE, and LEGACY_CHAT_TITLE as New chat", () => {
    expect(DEFAULT_CHAT_TITLE).toBe("New chat")
    expect(chatDisplayTitle(null)).toBe("New chat")
    expect(chatDisplayTitle("")).toBe("New chat")
    expect(chatDisplayTitle(DEFAULT_CHAT_TITLE)).toBe("New chat")
    expect(chatDisplayTitle(LEGACY_CHAT_TITLE)).toBe("New chat")
    expect(chatDisplayTitle(` ${LEGACY_CHAT_TITLE} `)).toBe("New chat")
    expect(chatDisplayTitle("About PM track CV")).toBe("About PM track CV")
  })
})

describe("titleFrom", () => {
  it("keeps short text and trims long titles", () => {
    expect(titleFrom("  Help me plan the week  ")).toBe("Help me plan the week")
    expect(titleFrom("x".repeat(40))).toBe(`${"x".repeat(36)}…`)
  })
})

describe("latestCoachMessageId", () => {
  it("returns the last persisted coach message, ignoring the streaming row", () => {
    expect(latestCoachMessageId([])).toBeNull()
    expect(
      latestCoachMessageId([
        { id: "u1", role: "user", text: "Hi" },
        { id: "c1", role: "coach", text: "First" },
        { id: "c2", role: "coach", text: "Second" },
        { id: STREAMING_COACH_ID, role: "coach", text: "Now" },
      ])
    ).toBe("c2")
  })
})

describe("toChatViewMessages", () => {
  it("copies server messages including parts and worked time", () => {
    const parts = [
      { type: "text" as const, text: "Hi" },
      {
        type: "tool" as const,
        name: "job.move",
        summary: "Moved 'Backend Intern' to Prep",
        ok: true,
      },
    ]
    const mapped = toChatViewMessages([
      { id: "u1", role: "user", text: "Hello" },
      {
        id: "c1",
        role: "coach",
        text: "Hi",
        workedMs: 800,
        status: "final",
        parts,
      },
      { id: "u2", role: "user", text: "Again" },
      {
        id: "c2",
        role: "coach",
        text: "Still here",
        workedMs: 1400,
        status: "final",
      },
    ])

    expect(mapped[1]).toEqual({
      id: "c1",
      role: "coach",
      text: "Hi",
      workedMs: 800,
      status: "final",
      parts,
    })
    expect(mapped[3]).toEqual({
      id: "c2",
      role: "coach",
      text: "Still here",
      workedMs: 1400,
      status: "final",
    })
  })
})
