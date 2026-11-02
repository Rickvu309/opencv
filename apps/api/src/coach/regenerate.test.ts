import { chatDetailSchema, personActor } from "@workspace/domain"
import { simulateReadableStream } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import type { SSEStreamingApi } from "hono/streaming"
import { describe, expect, it, vi } from "vitest"
import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"
import { runCoachTurn } from "./turn.js"

describe("Coach regeneration", () => {
  it("keeps a selected Paper response final without executing mutations", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      await db
        .insert(user)
        .values({ id: "regen-user", name: "Ada", email: "regen@verify.local" })
      await withDatabase(db, async () => {
        const registry = installRegistry()
        const actor = personActor("regen-user")
        const created = await registry.execute({
          name: "chat.create",
          input: { title: "Paper review" },
          actor,
        })
        const chatId = (created.output as { id: string }).id
        const written: { event?: string; data: string }[] = []
        const stream = {
          aborted: false,
          onAbort: () => {},
          writeSSE: async (value: { event?: string; data: string }) => {
            written.push(value)
          },
          write: async () => {},
        } as unknown as SSEStreamingApi
        const execute = vi.spyOn(registry, "execute")
        const tools = vi.spyOn(registry, "tools")
        const model = new MockLanguageModelV3({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: "text-start", id: "t" },
                {
                  type: "text-delta",
                  id: "t",
                  delta: "Here is an alternative wording for your review.",
                },
                { type: "text-end", id: "t" },
                {
                  type: "finish",
                  finishReason: { unified: "stop", raw: undefined },
                  usage: {
                    inputTokens: {
                      total: 1,
                      noCache: 1,
                      cacheRead: 0,
                      cacheWrite: 0,
                    },
                    outputTokens: { total: 1, text: 1, reasoning: 0 },
                  },
                },
              ],
            }),
          }),
        })
        try {
          await runCoachTurn({
            stream,
            registry,
            model,
            userId: "regen-user",
            chatId,
            mode: "free",
            plan: "free",
            provider: "test",
            modelId: "test",
            allowTools: false,
            history: [
              {
                id: "p",
                role: "user",
                text: "Rewrite this selection",
                createdAt: new Date().toISOString(),
              },
            ],
            selection: { text: "Student with Python experience" },
            focusDoc: {
              id: "paper",
              name: "CV",
              kind: "cv",
              status: "draft",
              outline: "[header] name: Ada",
              revision: 1,
            },
            heartbeatMs: 60000,
          })
          expect(tools).not.toHaveBeenCalled()
          expect(execute).not.toHaveBeenCalled()
          expect(written.some((event) => event.event === "error")).toBe(false)
          const detail = chatDetailSchema.parse(
            await registry.read("chat.get", { chatId }, actor)
          )
          expect(
            detail.messages.filter((message) => message.role === "coach")
          ).toEqual([
            expect.objectContaining({
              status: "final",
              text: "Here is an alternative wording for your review.",
            }),
          ])
        } finally {
          execute.mockRestore()
          tools.mockRestore()
        }
      })
    } finally {
      await client.close()
    }
  })
})
