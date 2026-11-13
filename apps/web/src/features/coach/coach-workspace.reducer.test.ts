import { describe, expect, it } from "vitest"

import {
  initialWorkspaceState,
  pendingSentLine,
  workspaceReducer,
  type SentBubble,
} from "./coach-workspace.reducer.ts"

const TEXT = "Remember the old line"

function sent(overrides: Partial<SentBubble> = {}): SentBubble {
  return {
    text: TEXT,
    seen: 0,
    chatId: null,
    revision: 0,
    attachments: [],
    ...overrides,
  }
}

function heldIn(line: SentBubble) {
  return workspaceReducer(
    initialWorkspaceState("", line.chatId, line.revision),
    { type: "draft_sent", sent: line }
  )
}

function turn(
  overrides: Partial<Parameters<typeof pendingSentLine>[1]> = {}
): Parameters<typeof pendingSentLine>[1] {
  return {
    chatId: null,
    navigationRevision: 0,
    messages: [],
    phase: "waiting",
    ...overrides,
  }
}

describe("pending sent line", () => {
  it("shows the line while its own turn runs and the message is not stored", () => {
    const line = sent()
    expect(pendingSentLine(line, turn())).toBe(line)
    expect(pendingSentLine(line, turn({ phase: "streaming" }))).toBe(line)
  })

  it("keeps only the latest send", () => {
    const first = heldIn(sent({ text: "First" }))
    const second = workspaceReducer(first, {
      type: "draft_sent",
      sent: sent({ text: "Second" }),
    })
    expect(second.sent).toEqual(sent({ text: "Second" }))
    expect(second.draft).toBe("")
  })

  it("follows a new chat when this composer created it", () => {
    const named = workspaceReducer(heldIn(sent()), {
      type: "active_chat_changed",
      chatId: "chat-1",
      navigationRevision: 0,
      createdHere: true,
      seeded: null,
    })
    expect(named.sent).toEqual(sent({ chatId: "chat-1" }))
  })

  it("drops the line when another composer created the chat", () => {
    const elsewhere = workspaceReducer(heldIn(sent()), {
      type: "active_chat_changed",
      chatId: "chat-1",
      navigationRevision: 0,
      createdHere: false,
      seeded: null,
    })
    expect(elsewhere.sent).toBeNull()
  })

  it("drops the line when the person starts a new chat", () => {
    const named = workspaceReducer(heldIn(sent()), {
      type: "active_chat_changed",
      chatId: "chat-1",
      navigationRevision: 0,
      createdHere: true,
      seeded: null,
    })
    const fresh = workspaceReducer(named, {
      type: "active_chat_changed",
      chatId: null,
      navigationRevision: 1,
      createdHere: false,
      seeded: null,
    })
    expect(fresh.sent).toBeNull()
  })

  it("drops the line when the person opens another chat", () => {
    const other = workspaceReducer(
      heldIn(sent({ chatId: "chat-1", revision: 2 })),
      {
        type: "active_chat_changed",
        chatId: "chat-2",
        navigationRevision: 3,
        createdHere: false,
        seeded: null,
      }
    )
    expect(other.sent).toBeNull()
  })

  it("clears the stored line on request", () => {
    const cleared = workspaceReducer(heldIn(sent()), { type: "sent_cleared" })
    expect(cleared.sent).toBeNull()
  })

  it("hides the line once that turn's message is stored", () => {
    expect(
      pendingSentLine(
        sent(),
        turn({ messages: [{ role: "user", text: TEXT }] })
      )
    ).toBeNull()
  })

  it("keeps a second send of the same text until that copy is stored", () => {
    const line = sent({ seen: 1 })
    const once = [{ role: "user", text: TEXT }]
    expect(pendingSentLine(line, turn({ messages: once }))).toBe(line)
    expect(
      pendingSentLine(line, turn({ messages: [...once, ...once] }))
    ).toBeNull()
  })

  it("hides the line when the turn ends or is stopped, even if nothing was stored", () => {
    expect(pendingSentLine(sent(), turn({ phase: "idle" }))).toBeNull()
  })

  it("keeps an unstored line when the send failed", () => {
    const line = sent()
    expect(
      pendingSentLine(line, turn({ phase: "idle", retainUnstored: true }))
    ).toBe(line)
    expect(
      pendingSentLine(
        line,
        turn({
          phase: "idle",
          retainUnstored: true,
          messages: [{ role: "user", text: TEXT }],
        })
      )
    ).toBeNull()
  })

  it("never shows a line in another chat or after navigation", () => {
    expect(pendingSentLine(sent(), turn({ navigationRevision: 1 }))).toBeNull()
    expect(pendingSentLine(sent(), turn({ chatId: "chat-2" }))).toBeNull()
  })
})
