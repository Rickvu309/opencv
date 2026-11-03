import { z } from "zod"

import {
  coachReceiptDetailSchema,
  reversalDescriptorSchema,
} from "./chat-messages.js"
import { commands, type ContractCommandName } from "./contract-commands.js"
import type { CommandEnvelope } from "./envelope.js"
import { queries, type QueryName } from "./queries.js"

export type ChatToolName = ContractCommandName | QueryName

const toolNames = [...Object.keys(commands), ...Object.keys(queries)] as [
  ChatToolName,
  ...ChatToolName[],
]

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

const chatTurnEventSchema = z.discriminatedUnion("type", [
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
      pendingActionId: z.string().optional(),
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
type ChatTurnEventType = ChatTurnEvent["type"]
export type ChatTurnEventOf<T extends ChatTurnEventType> = Extract<
  ChatTurnEvent,
  { type: T }
>

export function encodeChatTurnEvent(event: ChatTurnEvent): {
  event: string
  data: string
} {
  const { type, ...data } = chatTurnEventSchema.parse(event)
  return { event: type, data: JSON.stringify(data) }
}

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
