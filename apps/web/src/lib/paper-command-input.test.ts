import { NATIVE_WRITER } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { paperCommandInput } from "./paper-command-input.ts"

describe("native Paper metadata commands", () => {
  it.each(["paper.rename", "paper.duplicate", "paper.setStatus"])(
    "qualifies %s without changing its input",
    (name) => {
      const input = { docId: "letter", name: "Letter" }
      expect(paperCommandInput(name, input)).toEqual({
        ...input,
        writer: NATIVE_WRITER,
      })
      expect(input).not.toHaveProperty("writer")
    }
  )

  it("preserves an explicit incompatible manifest for server refusal", () => {
    const input = { docId: "letter", writer: { documentVersion: 5 } }
    expect(paperCommandInput("paper.rename", input)).toBe(input)
  })

  it("leaves creation, export and other command inputs unchanged", () => {
    const input = { docId: "letter" }
    for (const name of [
      "paper.create",
      "paper.export",
      "paper.edit",
      "paper.sync",
    ])
      expect(paperCommandInput(name, input)).toBe(input)
  })
})
