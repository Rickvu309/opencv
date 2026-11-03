import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_CHAT_TITLE,
  LEGACY_CHAT_TITLE,
  chatDisplayTitle,
  coachTurnRequestSchema,
  textFromParts,
} from "./chat-messages.ts"
import { shouldAutoTitleChat, titleFrom } from "./chat-title.ts"

const FIRST_LINE_TITLE_MAX = 36

describe("chat titles", () => {
  it("shows the default title for a blank, default or legacy stored title", () => {
    for (const stored of [
      null,
      undefined,
      "  ",
      DEFAULT_CHAT_TITLE,
      LEGACY_CHAT_TITLE,
    ]) {
      assert.equal(chatDisplayTitle(stored), DEFAULT_CHAT_TITLE)
    }
    assert.equal(chatDisplayTitle(" Resume tips "), "Resume tips")
  })

  it("clips the first-line title and keeps a short one whole", () => {
    assert.equal(titleFrom("  Fix   my\nCV "), "Fix my CV")
    const clipped = titleFrom("x".repeat(FIRST_LINE_TITLE_MAX + 10))
    assert.equal(clipped, `${"x".repeat(FIRST_LINE_TITLE_MAX)}…`)
  })

  const base = {
    messages: [{ role: "user" as const, text: "Help with my cover letter" }],
    status: "final",
  }

  it("replaces a default or first-line title and never a renamed one", () => {
    const expected = { userText: "Help with my cover letter" }
    for (const currentTitle of [
      DEFAULT_CHAT_TITLE,
      titleFrom(base.messages[0]!.text),
    ]) {
      assert.deepEqual(shouldAutoTitleChat({ ...base, currentTitle }), expected)
    }
    assert.equal(
      shouldAutoTitleChat({ ...base, currentTitle: "My title" }),
      null
    )
  })

  it("counts a final or status-less coach row as a completed turn", () => {
    for (const status of ["final", null, undefined]) {
      const messages = [
        ...base.messages,
        { role: "coach" as const, text: "Sure", status },
      ]
      assert.equal(
        shouldAutoTitleChat({
          ...base,
          messages,
          currentTitle: DEFAULT_CHAT_TITLE,
        }),
        null
      )
    }
  })

  it("lets a later successful turn title the chat after an aborted or errored one", () => {
    for (const status of ["aborted", "error"]) {
      const messages = [
        ...base.messages,
        { role: "coach" as const, text: "", status },
      ]
      assert.notEqual(
        shouldAutoTitleChat({
          ...base,
          messages,
          currentTitle: DEFAULT_CHAT_TITLE,
        }),
        null
      )
    }
  })
})

describe("chat messages", () => {
  it("joins text parts in order and skips tool parts", () => {
    const tool = {
      type: "tool" as const,
      name: "job.create",
      summary: "s",
      ok: true,
    }
    assert.equal(
      textFromParts([
        { type: "text", text: "a" },
        tool,
        { type: "text", text: "b" },
      ]),
      "ab"
    )
  })

  it("accepts a null focusDocId, which clears Paper grounding for the turn", () => {
    const parsed = coachTurnRequestSchema.parse({
      text: "hi",
      focusDocId: null,
    })
    assert.equal(parsed.focusDocId, null)
  })

  it("needs message text unless the turn regenerates", () => {
    assert.equal(coachTurnRequestSchema.safeParse({}).success, false)
    assert.equal(
      coachTurnRequestSchema.safeParse({ regenerate: true }).success,
      true
    )
  })
})
