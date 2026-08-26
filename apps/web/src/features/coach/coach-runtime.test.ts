import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { STREAMING_COACH_ID } from "@/features/home/threads.ts"

import {
  RECEIPT_PART_NAME,
  toAssistantUiMessage,
} from "./coach-runtime.ts"

const here = path.dirname(fileURLToPath(import.meta.url))

function read(rel: string) {
  return readFileSync(path.join(here, rel), "utf8")
}

describe("assistant-ui ExternalStoreRuntime spike", () => {
  it("projects HomeMessage without forking ids, text, or receipt parts", () => {
    const receipt = {
      type: "tool" as const,
      name: "paper_updateContent",
      summary: "Updated PM track CV",
      ok: true,
      toolCallId: "call-1",
      detail: {
        type: "paper.updateContent" as const,
        docId: "doc-1",
        docKind: "cv" as const,
        docName: "PM track CV",
        hunks: [],
      },
    }
    const source = {
      id: "coach-1",
      role: "coach" as const,
      text: "I read PM track CV.",
      rating: "up" as const,
      workedMs: 1400,
      parts: [{ type: "text" as const, text: "I read PM track CV." }, receipt],
    }

    const projected = toAssistantUiMessage(source)
    expect(projected.id).toBe(source.id)
    expect(projected.role).toBe("assistant")
    expect(projected.content).toEqual([
      { type: "text", text: "I read PM track CV." },
      { type: `data-${RECEIPT_PART_NAME}`, data: receipt },
    ])
    expect(projected.metadata?.submittedFeedback).toEqual({ type: "positive" })
    expect(projected.metadata?.custom).toMatchObject({
      workedMs: 1400,
      rating: "up",
      rateable: true,
    })
    expect(projected.content[1]).toMatchObject({
      data: receipt,
    })
    expect((projected.content[1] as { data: unknown }).data).toBe(receipt)
  })

  it("marks the live Coach turn as running and maps failed user turns", () => {
    const streaming = toAssistantUiMessage({
      id: STREAMING_COACH_ID,
      role: "coach",
      text: "Partial",
      parts: [{ type: "text", text: "Partial" }],
    })
    expect(streaming.status).toEqual({ type: "running" })

    const failed = toAssistantUiMessage({
      id: "local-1",
      role: "user",
      text: "Hello",
      failed: true,
      error: "The Coach is unavailable right now",
    })
    expect(failed.role).toBe("user")
    expect(failed.status).toEqual({
      type: "incomplete",
      reason: "error",
      error: "The Coach is unavailable right now",
    })
  })

  it("keeps React Query as the message owner — no setMessages, no local list", () => {
    const adapter = read("coach-runtime.ts")
    expect(adapter).toMatch(/useExternalStoreRuntime/)
    expect(adapter).toMatch(/useCoachTurn/)
    expect(adapter).toMatch(/convertMessage: toAssistantUiMessage/)
    expect(adapter).not.toMatch(/setMessages/)
    expect(adapter).not.toMatch(/useState<\s*HomeMessage/)
    expect(adapter).not.toMatch(/useChat/)

    const pkg = JSON.parse(
      readFileSync(path.join(here, "../../../package.json"), "utf8")
    ) as { dependencies: Record<string, string> }
    expect(pkg.dependencies["@assistant-ui/react"]).toBe("0.15.16")
    expect(pkg.dependencies["@assistant-ui/react"]).not.toMatch(/^\^|~/)

    const float = read("../paper/coach-float.tsx")
    expect(float).toMatch(/useCoachExternalRuntime/)
    expect(float).toMatch(/useCoachTurn/)
    expect(float).toMatch(/CoachThread/)
    expect(float).not.toMatch(/ThreadView/)
    expect(float).not.toMatch(/AI assist/)
    expect(float).not.toMatch(/Sparkles/)
  })
})
