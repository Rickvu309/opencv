import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"
import { getChat } from "@/features/coach/chat-api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

function envelope<T>(data: T) {
  return Response.json({ ok: true, data })
}

const CHAT_ID = "11111111-1111-4111-8111-111111111111"
const STAMP = "2026-08-25T00:00:00.000Z"

function chatRow() {
  return {
    id: CHAT_ID,
    title: "Plan the week",
    focusKind: null,
    focusId: null,
    createdAt: STAMP,
    updatedAt: STAMP,
  }
}

function attachmentMessage(parts: unknown[]) {
  return {
    id: "m1",
    chatId: CHAT_ID,
    role: "person",
    text: "Help",
    createdAt: STAMP,
    parts,
    status: "final",
    workedMs: null,
  }
}

describe("chat attachment mapping", () => {
  it("keeps saved attachments through detail mapping and resolves their labels", async () => {
    const fetchMock = vi.fn((input: string) => {
      if (String(input).endsWith("/api/jobs"))
        return Promise.resolve(
          envelope([
            { id: "job-1", title: "Product role", company: "Northwind" },
          ])
        )
      if (String(input).endsWith("/api/paper"))
        return Promise.resolve(
          envelope([{ id: "paper-1", name: "Journey CV" }])
        )
      return Promise.resolve(
        envelope({
          ...chatRow(),
          messages: [
            attachmentMessage([
              { type: "text", text: "Help" },
              { type: "attachment", kind: "job", id: "job-1" },
              { type: "attachment", kind: "paper", id: "paper-1" },
              {
                type: "attachment",
                kind: "link",
                id: "https://example.com/career-guide",
              },
            ]),
            {
              id: "m2",
              chatId: CHAT_ID,
              role: "coach",
              text: "Done",
              createdAt: STAMP,
              parts: [{ type: "text", text: "Done" }],
              status: "final",
              workedMs: 900,
            },
          ],
        })
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const detail = await getChat(CHAT_ID)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toBe(`${apiBaseUrl}/api/reads/chat.get`)
    expect(detail.messages).toEqual([
      {
        id: "m1",
        role: "user",
        text: "Help",
        createdAt: STAMP,
        parts: [{ type: "text", text: "Help" }],
        attachments: [
          { kind: "job", id: "job-1", label: "Product role at Northwind" },
          { kind: "paper", id: "paper-1", label: "Journey CV" },
          {
            kind: "link",
            id: "https://example.com/career-guide",
            label: "example.com",
          },
        ],
        status: "final",
      },
      {
        id: "m2",
        role: "coach",
        text: "Done",
        createdAt: STAMP,
        parts: [{ type: "text", text: "Done" }],
        status: "final",
        workedMs: 900,
      },
    ])
  })

  it("keeps stable attachment labels when job and paper lookups fail", async () => {
    const fetchMock = vi.fn((input: string) => {
      if (String(input).endsWith("/api/jobs"))
        return Promise.reject(new Error("jobs temporarily unavailable"))
      if (String(input).endsWith("/api/paper"))
        return Promise.reject(new Error("paper temporarily unavailable"))
      return Promise.resolve(
        envelope({
          ...chatRow(),
          messages: [
            attachmentMessage([
              { type: "text", text: "Help" },
              { type: "attachment", kind: "job", id: "job-1" },
              { type: "attachment", kind: "paper", id: "paper-1" },
            ]),
          ],
        })
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(getChat(CHAT_ID)).resolves.toMatchObject({
      messages: [
        {
          attachments: [
            { kind: "job", id: "job-1", label: "Saved job" },
            { kind: "paper", id: "paper-1", label: "Saved document" },
          ],
        },
      ],
    })
  })
})
