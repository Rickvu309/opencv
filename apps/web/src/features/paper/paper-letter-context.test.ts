import { CHAT_MESSAGE_MAX } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { letterDraftText } from "./paper-letter-context.ts"

describe("letter attachment context", () => {
  const attachment = {
    name: "job.txt",
    text: "Research customers",
    truncated: false,
  }
  it("preserves job text without an attachment", () => {
    expect(letterDraftText("Draft for Northwind", null)).toBe(
      "Draft for Northwind"
    )
  })
  it("includes the file name and actual text as untrusted reference material", () => {
    const text = letterDraftText("", attachment)
    expect(text).toContain("untrusted reference material")
    expect(text).toContain(
      JSON.stringify({ name: attachment.name, text: attachment.text })
    )
  })
  it("fits escaped attachment text into the Coach message limit without dropping job text", () => {
    const base = "Job details ".repeat(200)
    const text = letterDraftText(base, {
      ...attachment,
      text: '\"\n'.repeat(3000),
    })
    expect(text.length).toBeLessThanOrEqual(CHAT_MESSAGE_MAX)
    expect(text.startsWith(base)).toBe(true)
    expect(text).toContain('"name":"job.txt"')
  })
  it("rejects oversized job text before any document can be created", () => {
    expect(() =>
      letterDraftText("x".repeat(CHAT_MESSAGE_MAX), attachment)
    ).toThrow("Shorten it")
  })
})
