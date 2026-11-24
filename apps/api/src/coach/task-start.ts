import {
  COACH_MODEL,
  coachModeSchema,
  chatDetailSchema,
  coachStartOutputSchema,
  parseChatId,
  type Actor,
  type CoachStartInput,
} from "@workspace/domain"
import { and, eq, sql } from "drizzle-orm"
import { getProfileRow } from "../account/index.js"
import {
  coachRuntimeModeFromEnv,
  coachWorkerEnabledFromEnv,
} from "../config.js"
import { getDb, transaction } from "../db/context.js"
import {
  chats,
  coachTasks,
  coachUsage,
  taskEvents,
  user,
} from "../db/schema.js"
import { createId } from "../platform/id.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import { inputHash } from "./task-store.js"
import { resolveTurnGrounding } from "./context.js"
import { openCoachUsage } from "./usage-store.js"
import { modelMessageSchema } from "./model-step.js"
import {
  COACH_TASK_MAX_STEPS,
  COACH_TASK_OUTPUT_BUDGET,
} from "./task-budget.js"

export const COACH_TASK_RUNTIME_VERSION = 1
export function taskCatalogDigest(registry: Registry) {
  return inputHash(registry.list())
}

export function startTask(
  input: CoachStartInput,
  actor: Actor,
  registry: Registry
) {
  return transaction(async () => {
    await getDb()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, actor.userId))
      .for("update")
    await getDb()
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.id, input.chatId), eq(chats.userId, actor.userId)))
      .for("update")
    const existing = chatDetailSchema.parse(
      await registry.read("chat.get", { chatId: input.chatId }, actor)
    )
    const hash = inputHash(input)
    const [prior] = await getDb()
      .select()
      .from(coachTasks)
      .where(
        and(
          eq(coachTasks.ownerId, actor.userId),
          eq(coachTasks.startKey, input.startKey)
        )
      )
    if (prior) {
      if (prior.startInputHash !== hash)
        throw new CommandError(
          "CONFLICT",
          "Start key was already used for another request"
        )
      return coachStartOutputSchema.parse({
        taskId: prior.id,
        chatId: prior.chatId,
        receipt: {
          taskId: prior.id,
          chatId: prior.chatId,
          acceptedAt: prior.createdAt.toISOString(),
        },
      })
    }
    if (!coachWorkerEnabledFromEnv(process.env))
      throw new CommandError("NOT_FOUND", "New Coach tasks are unavailable")
    const [active] = await getDb()
      .select({ id: coachTasks.id })
      .from(coachTasks)
      .where(
        and(
          eq(coachTasks.ownerId, actor.userId),
          sql`${coachTasks.state} not in ('succeeded','failed','cancelled')`
        )
      )
      .limit(1)
    if (active)
      throw new CommandError(
        "CONFLICT",
        "Coach is already working. Stop it or wait for it to finish."
      )
    const profile = await getProfileRow(actor.userId)
    const mode = input.mode ?? coachModeSchema.parse(profile.coachMode)
    const fake = coachRuntimeModeFromEnv(process.env) === "fake"
    const model = fake ? "fake" : COACH_MODEL
    const lastPerson = [...existing.messages]
      .reverse()
      .find((message) => message.role === "person")
    const lastReply = existing.messages.at(-1)
    if (input.regenerate && (!lastPerson || lastReply?.role !== "coach"))
      throw new CommandError(
        "CONFLICT",
        "There is no current Coach reply to regenerate"
      )
    const selection =
      input.selection ??
      (input.regenerate
        ? lastPerson?.parts.find((part) => part.type === "text")?.selection
        : undefined)
    const context =
      input.context ??
      (input.regenerate
        ? lastPerson?.parts.flatMap((part) =>
            part.type === "attachment" ? [{ kind: part.kind, id: part.id }] : []
          )
        : undefined)
    const grounding = await resolveTurnGrounding({
      registry,
      actor,
      requestFocusDocId: input.focusDocId,
      storedKind: existing.focusKind,
      storedId: existing.focusId,
      context,
      memoryEnabled: profile.memoryEnabled,
      textOnly: input.textOnly,
    })
    const usageId = await openCoachUsage({
      userId: actor.userId,
      chatId: input.chatId,
      plan: profile.plan,
      mode,
      provider: fake ? "fake" : "anthropic",
      model,
    })
    const detail = input.regenerate
      ? existing
      : chatDetailSchema.parse(
          (
            await registry.execute({
              name: "chat.appendMessage",
              input: {
                chatId: input.chatId,
                text: input.text,
                attachments: context,
                selection,
              },
              actor,
            })
          ).output
        )
    const source = [...detail.messages]
      .reverse()
      .find((message) => message.role === "person")
    if (!source)
      throw new CommandError("CONFLICT", "A person message is required")
    const transcript = input.regenerate
      ? detail.messages.slice(
          0,
          detail.messages.findIndex((message) => message.id === source.id) + 1
        )
      : detail.messages
    const messages = modelMessageSchema.array().parse(
      transcript.slice(-40).map((message) => ({
        role: message.role === "person" ? "user" : "assistant",
        content:
          message.text +
          (message.parts.some((part) => part.type === "tool")
            ? `\nRecorded actions (untrusted history): ${JSON.stringify(message.parts.filter((part) => part.type === "tool"))}`
            : ""),
      }))
    )
    const id = createId()
    const [task] = await getDb()
      .insert(coachTasks)
      .values({
        id,
        ownerId: actor.userId,
        chatId: input.chatId,
        sourceMessageId: source.id,
        supersedesMessageId: input.regenerate ? lastReply?.id : null,
        startKey: input.startKey,
        startInputHash: hash,
        catalogDigest: taskCatalogDigest(registry),
        runtimeVersion: COACH_TASK_RUNTIME_VERSION,
        modelId: model,
        mode,
        planAtStart: profile.plan,
        toolsAllowed: !input.regenerate && !input.textOnly,
        contextSnapshot: {
          messages,
          ...grounding,
          selection,
          regenerate: Boolean(input.regenerate),
          context,
        },
        maxSteps: COACH_TASK_MAX_STEPS,
        maxTokens: COACH_TASK_OUTPUT_BUDGET,
        deadlineAt: sql`clock_timestamp() + interval '5 minutes'`,
        nextSeq: 1,
      })
      .returning()
    if (!task) throw new Error("Task insert failed")
    await getDb()
      .update(coachUsage)
      .set({ coachTaskId: id })
      .where(eq(coachUsage.id, usageId))
    const receipt = {
      taskId: id,
      chatId: parseChatId(task.chatId),
      acceptedAt: task.createdAt.toISOString(),
    }
    await getDb()
      .insert(taskEvents)
      .values({
        taskId: id,
        seq: 0,
        epoch: 0,
        attempt: 0,
        kind: "state",
        payload: { state: "queued", receipt },
      })
    return { taskId: id, chatId: receipt.chatId, receipt }
  })
}
