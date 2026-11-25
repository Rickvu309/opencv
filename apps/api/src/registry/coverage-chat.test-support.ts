import { catalog, DEFAULT_CHAT_TITLE } from "@workspace/domain"
import { expect } from "vitest"

import { stopChat, trackChatTurn } from "../coach/chat/index.js"
import {
  flag,
  idOf,
  list,
  text,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.test-support.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { implementation as stopReply } from "../coach/operations/stop/server.js"
import { implementation as approve } from "./operations/actions/approve/server.js"
import { implementation as deny } from "./operations/actions/deny/server.js"
import { implementation as undoOperation } from "./operations/activity/undo/server.js"

export function chatCases(tools: CoverageTools): CoverageCase[] {
  const { ctx, run, undo, chatOf, jobOf, gone, registry, userId } = tools
  return [
    {
      name: catalog["chat.create"].name,
      arrange: async () => {},
      act: () => run("chat.create", { title: "Coverage" }),
      assert: async (result) => {
        const chat = await chatOf(idOf(result.output))
        expectTitle(chat, "Coverage")
      },
    },
    {
      name: catalog["chat.rename"].name,
      arrange: async () => {
        const chat = await run("chat.create", { title: "Coverage" })
        ctx.chatId = idOf(chat.output)
      },
      act: () =>
        run("chat.rename", { chatId: ctx.chatId, title: "Renamed chat" }),
      assert: async () => {
        expectTitle(await chatOf(ctx.chatId), "Renamed chat")
      },
      undoAssert: async (result) => {
        await undo(result)
        expectTitle(await chatOf(ctx.chatId), "Coverage")
      },
    },
    {
      name: catalog["chat.open"].name,
      arrange: async () => {},
      act: () => run("chat.open", {}),
      assert: async (result) => {
        expectTitle(await chatOf(idOf(result.output)), DEFAULT_CHAT_TITLE)
      },
    },
    {
      name: catalog["chat.setFocus"].name,
      arrange: async () => {
        const chat = await run("chat.create", { title: "Focus" })
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Focus CV",
        })
        ctx.chatId = idOf(chat.output)
        ctx.docId = idOf(paper.output)
      },
      act: () =>
        run("chat.setFocus", {
          chatId: ctx.chatId,
          focus: { kind: "paper", id: ctx.docId },
        }),
      assert: async () => {
        const chat = await chatOf(ctx.chatId)
        expect(text(chat, "focusKind")).toBe("paper")
        expect(text(chat, "focusId")).toBe(ctx.docId)
      },
      undoAssert: async (result) => {
        await undo(result)
        const chat = await chatOf(ctx.chatId)
        expect(text(chat, "focusKind")).toBeNull()
        expect(text(chat, "focusId")).toBeNull()
      },
    },
    {
      name: catalog["chat.appendMessage"].name,
      arrange: async () => {
        const chat = await run("chat.create", { title: "Messages" })
        ctx.chatId = idOf(chat.output)
      },
      act: () =>
        run("chat.appendMessage", { chatId: ctx.chatId, text: "Hello" }),
      assert: async () => {
        const messages = list(await chatOf(ctx.chatId), "messages").map(
          (item) => text(item, "text")
        )
        expect(messages).toContain("Hello")
      },
    },
    {
      name: catalog["chat.delete"].name,
      arrange: async () => {
        const chat = await run("chat.create", { title: "Gone" })
        ctx.chatId = idOf(chat.output)
      },
      act: () => run("chat.delete", { chatId: ctx.chatId }),
      assert: async () => {
        await gone(chatOf(ctx.chatId))
      },
    },
    {
      name: stopReply.operation.name,
      arrange: async () => {
        const chat = await run("chat.create", { title: "Stop" })
        ctx.chatId = idOf(chat.output)
        trackChatTurn(ctx.chatId, new AbortController())
      },
      act: () => run("coach.stop", { chatId: ctx.chatId }),
      assert: async (result) => {
        expect(flag(result.output, "stopped")).toBe(true)
        expect(stopChat(ctx.chatId)).toBe(false)
      },
    },
    {
      name: approve.operation.name,
      arrange: async () => {
        const chat = await run("chat.create", { title: "Approve" })
        const job = await run("job.create", {
          title: "Approve",
          company: "Northwind",
        })
        ctx.jobId = idOf(job.output)
        const pending = await registry.execute({
          name: catalog["job.move"].name,
          input: { jobId: ctx.jobId, stage: "interview" },
          actor: await seedCoachActor(userId, idOf(chat.output)),
        })
        if (!pending.pendingActionId) {
          throw new Error("missing pending action")
        }
        ctx.pendingId = pending.pendingActionId
      },
      act: () => run("actions.approve", { pendingActionId: ctx.pendingId }),
      assert: async () => {
        expect(text(await jobOf(ctx.jobId), "stage")).toBe("interview")
      },
    },
    {
      name: deny.operation.name,
      arrange: async () => {
        const chat = await run("chat.create", { title: "Deny" })
        const job = await run("job.create", {
          title: "Deny",
          company: "Northwind",
        })
        ctx.jobId = idOf(job.output)
        const pending = await registry.execute({
          name: catalog["job.move"].name,
          input: { jobId: ctx.jobId, stage: "interview" },
          actor: await seedCoachActor(userId, idOf(chat.output)),
        })
        if (!pending.pendingActionId) {
          throw new Error("missing pending action")
        }
        ctx.pendingId = pending.pendingActionId
      },
      act: () => run("actions.deny", { pendingActionId: ctx.pendingId }),
      assert: async () => {
        expect(text(await jobOf(ctx.jobId), "stage")).toBe("saved")
      },
    },
    {
      name: undoOperation.operation.name,
      arrange: async () => {
        const job = await run("job.create", {
          title: "Undo",
          company: "Northwind",
        })
        ctx.jobId = idOf(job.output)
        const moved = await run("job.move", {
          jobId: ctx.jobId,
          stage: "applied",
        })
        if (!moved.activityId) throw new Error("missing activity")
        ctx.activityId = moved.activityId
      },
      act: () => run("activity.undo", { activityId: ctx.activityId }),
      assert: async () => {
        expect(text(await jobOf(ctx.jobId), "stage")).toBe("saved")
      },
    },
  ]
}

function expectTitle(chat: unknown, title: string) {
  expect(text(chat, "title")).toBe(title)
}
