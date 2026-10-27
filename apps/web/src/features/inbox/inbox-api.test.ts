import { afterEach, describe, expect, it, vi } from "vitest"

import { jsonOk, pathOf } from "@/test/mock-http.ts"

import { acceptSuggestion, scanInbox, sendReply } from "./inbox-api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("inbox api", () => {
  it("posts scan, send, and accept under those command names", async () => {
    const calls: { path: string; input: unknown }[] = []
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : null
        calls.push({ path: pathOf(input), input: body?.input })
        return jsonOk({
          threads: [],
          emailCount: 6,
          companyCount: 6,
          activityId: "00000000-0000-4000-8000-000000000099",
        })
      }
    )

    await scanInbox()
    await sendReply("00000000-0000-4000-8000-000000000001")
    await acceptSuggestion("00000000-0000-4000-8000-000000000002")

    expect(calls.map((call) => call.path)).toEqual([
      "/api/commands/inbox.scan",
      "/api/commands/inbox.send",
      "/api/commands/inbox.acceptSuggestion",
    ])
    expect(calls[1]?.input).toEqual({
      threadId: "00000000-0000-4000-8000-000000000001",
    })
    expect(calls[2]?.input).toEqual({
      threadId: "00000000-0000-4000-8000-000000000002",
    })
  })
})
