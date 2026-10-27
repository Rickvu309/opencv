import { z } from "zod"

import { coachReceiptDetailSchema } from "./threads.js"
import { reversalDescriptorSchema } from "./commands.js"
import { commands, type ContractCommandName } from "./contract-commands.js"
import type { CommandEnvelope } from "./envelope.js"
import { queries, type QueryName } from "./queries.js"

export type ChatToolName = ContractCommandName | QueryName

const toolNames = [...Object.keys(commands), ...Object.keys(queries)] as [
  ChatToolName,
  ...ChatToolName[],
]

/** The registry name a tool call carries on the wire. The model's `_` spelling stays inside the api. */
export const chatToolNameSchema = z.enum(toolNames)

export const commandNameSchema = z.enum(
  Object.keys(commands) as [ContractCommandName, ...ContractCommandName[]]
)

const anyValue = z.custom<unknown>(() => true)

const commandEnvelopeSchema = z.custom<CommandEnvelope>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ok?: unknown }).ok === "boolean"
)

/**
 * The SSE contract of one Coach turn (ADR-0009 section 11). The `type` is the
 * SSE `event:` name and the rest of the object is the JSON `data:` payload.
 */
export const chatTurnEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message-start"), chatId: z.string() }).strict(),
  z.object({ type: z.literal("text-delta"), text: z.string() }).strict(),
  z.object({ type: z.literal("step"), label: z.string() }).strict(),
  z
    .object({
      type: z.literal("tool-call"),
      toolCallId: z.string(),
      name: chatToolNameSchema,
      input: anyValue,
    })
    .strict(),
  z
    .object({
      type: z.literal("tool-result"),
      toolCallId: z.string(),
      name: chatToolNameSchema,
      summary: z.string(),
      ok: z.boolean(),
      result: commandEnvelopeSchema,
      reversal: reversalDescriptorSchema.optional(),
      detail: coachReceiptDetailSchema.optional(),
      activityId: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("confirm"),
      pendingActionId: z.string(),
      command: commandNameSchema,
      summary: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("usage"),
      plan: z.string(),
      mode: z.string(),
      capped: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("message-end"), chatId: z.string() }).strict(),
  z.object({ type: z.literal("error"), message: z.string() }).strict(),
])

export type ChatTurnEvent = z.output<typeof chatTurnEventSchema>
export type ChatTurnEventType = ChatTurnEvent["type"]
export type ChatTurnEventOf<T extends ChatTurnEventType> = Extract<
  ChatTurnEvent,
  { type: T }
>

/** The `event:` name and the JSON `data:` string for one event. Throws on a shape the contract does not allow. */
export function encodeChatTurnEvent(event: ChatTurnEvent): {
  event: string
  data: string
} {
  const { type, ...data } = chatTurnEventSchema.parse(event)
  return { event: type, data: JSON.stringify(data) }
}

/** Decode one received SSE event. An event the contract does not describe is `null`. */
export function parseChatTurnEvent(wire: {
  event: string
  data: unknown
}): ChatTurnEvent | null {
  if (typeof wire.data !== "object" || wire.data === null) return null
  const parsed = chatTurnEventSchema.safeParse({
    ...wire.data,
    type: wire.event,
  })
  return parsed.success ? parsed.data : null
}
