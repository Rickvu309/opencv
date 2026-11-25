import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  encodeChatTurnEvent,
  parseChatTurnEvent,
  type ChatTurnEvent,
} from "./coach/chat-turn.ts"

describe("chat turn events", () => {
  it("round-trips a tool-call through the wire form", () => {
    const event: ChatTurnEvent = {
      type: "tool-call",
      toolCallId: "t1",
      name: "paper.edit",
      input: { docId: "d" },
    }
    const wire = encodeChatTurnEvent(event)
    assert.equal(wire.event, "tool-call")
    assert.deepEqual(
      parseChatTurnEvent({ event: wire.event, data: JSON.parse(wire.data) }),
      event
    )
  })

  it("carries a notice as its own event, apart from reply text", () => {
    const event: ChatTurnEvent = {
      type: "notice",
      text: "Coach is still working. Reload this Chat to follow or stop it.",
    }
    const wire = encodeChatTurnEvent(event)
    assert.equal(wire.event, "notice")
    assert.deepEqual(
      parseChatTurnEvent({ event: wire.event, data: JSON.parse(wire.data) }),
      event
    )
  })

  it("rejects the model's underscore tool names and unknown events", () => {
    assert.equal(
      parseChatTurnEvent({
        event: "tool-call",
        data: { toolCallId: "t1", name: "paper_edit", input: {} },
      }),
      null
    )
    assert.equal(parseChatTurnEvent({ event: "mystery", data: {} }), null)
  })

  it("refuses to encode an event the contract does not allow", () => {
    assert.throws(() =>
      encodeChatTurnEvent({
        type: "tool-call",
        toolCallId: "t1",
        name: "paper_edit",
        input: {},
      } as never)
    )
  })
})
