import { chatDetailSchema, personActor, titleFrom } from "@workspace/domain"
import { simulateReadableStream, generateText } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import type { SSEStreamingApi } from "hono/streaming"
import { afterEach, describe, expect, it, vi } from "vitest"
import { withDatabase } from "../db/context.js"
import { coachUsage, user } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"
import { runCoachTurn } from "./turn.js"
import { coachModelEnv, setCoachModelEnv } from "../config.js"

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(async () => ({ text: "Interview prep" })),
}))

const rename = vi.hoisted(() => ({ fails: false }))

vi.mock("../chat/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../chat/index.js")>()
  return {
    ...actual,
    renameChat: (...args: Parameters<typeof actual.renameChat>) => {
      if (!rename.fails) return actual.renameChat(...args)
      rename.fails = false
      throw new Error("rename failed")
    },
  }
})

const prompt = "Help me prepare for a product intern interview"
const answer = "Tell me about a project you led."

async function completeTurn(
  options: { renameFails?: boolean; title?: string } = {}
) {
  const { client, db } = await createMigratedTestDb()
  const previousEnv = coachModelEnv()
  setCoachModelEnv({ OPENROUTER_API_KEY: "local-test" })
  try {
    await db
      .insert(user)
      .values({ id: "turn-user", name: "Ada", email: "turn@verify.local" })
    return await withDatabase(db, async () => {
      const registry = installRegistry()
      const actor = personActor("turn-user")
      const created = await registry.execute({
        name: "chat.create",
        input: { title: options.title ?? titleFrom(prompt) },
        actor,
      })
      const chatId = chatDetailSchema.parse(created.output).id
      await registry.execute({
        name: "chat.appendMessage",
        input: { chatId, text: prompt },
        actor,
      })
      rename.fails = options.renameFails === true
      const events: string[] = []
      const stream = {
        aborted: false,
        onAbort: () => {},
        writeSSE: async (event: { event?: string; data: string }) => {
          events.push(event.event ?? "")
        },
        write: async () => {},
      } as unknown as SSEStreamingApi
      const model = new MockLanguageModelV3({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "t" },
              { type: "text-delta", id: "t", delta: answer },
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
      await runCoachTurn({
        stream,
        registry,
        model,
        userId: "turn-user",
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
            text: prompt,
            createdAt: new Date().toISOString(),
          },
        ],
        heartbeatMs: 60000,
      })
      const saved = chatDetailSchema.parse(
        await registry.read("chat.get", { chatId }, actor)
      )
      const usage = await db.select().from(coachUsage)
      return { events, saved, usage }
    })
  } finally {
    setCoachModelEnv(previousEnv)
    await client.close()
  }
}

afterEach(() => vi.restoreAllMocks())

describe("Coach turn completion", () => {
  it("saves the reply and ends without a second model request", async () => {
    vi.mocked(generateText).mockClear()
    const { events, saved, usage } = await completeTurn()
    expect(events.at(-1)).toBe("message-end")
    expect(saved.title).toBe("Prepare for a product intern interview")
    expect(
      saved.messages.filter((message) => message.role === "coach")
    ).toMatchObject([{ text: answer, status: "final" }])
    expect(usage).toMatchObject([{ finishReason: "stop" }])
    expect(generateText).not.toHaveBeenCalled()
  })

  it("ends a saved turn when automatic rename fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const { events, saved, usage } = await completeTurn({ renameFails: true })
    expect(log).toHaveBeenCalledWith("Coach automatic title failed", {
      chatId: saved.id,
    })
    expect(events.at(-1)).toBe("message-end")
    expect(
      saved.messages.filter((message) => message.role === "coach")
    ).toMatchObject([{ text: answer, status: "final" }])
    expect(saved.title).toBe(titleFrom(prompt))
    expect(usage).toMatchObject([{ finishReason: "stop" }])
  })

  it("preserves a title chosen by the person", async () => {
    const { saved, events } = await completeTurn({ title: "My interview plan" })
    expect(saved.title).toBe("My interview plan")
    expect(events.at(-1)).toBe("message-end")
  })
})
