import { connectionResourcesSchema } from "./connections.js"
import { connectionIdSchema } from "./ids.js"
import { z } from "zod"
import type { ZodType } from "zod"

import { parseChatId, parseUserId, type ChatId, type UserId } from "./ids.js"
import type { IdempotencyPolicy } from "./contract.js"
import type { DelegateMarker } from "./operation.js"
import type { CoachAccess, ResourceRef } from "./resources.js"

export type { CoachAccess } from "./resources.js"

type PersonActor = {
  type: "person"
  userId: UserId
}

export type CoachActor = {
  type: "coach"
  userId: UserId
  chatId: ChatId
  turnId?: string
}

export function personActor(userId: string): PersonActor {
  return { type: "person", userId: parseUserId(userId) }
}

export function coachActor(
  userId: string,
  chatId: string,
  turnId: string
): CoachActor {
  return {
    type: "coach",
    userId: parseUserId(userId),
    chatId: parseChatId(chatId),
    turnId,
  }
}

export function approvedProposalActor(
  userId: string,
  chatId: string
): CoachActor {
  return {
    type: "coach",
    userId: parseUserId(userId),
    chatId: parseChatId(chatId),
  }
}

export const delegateActorSchema = z
  .object({
    type: z.literal("delegate"),
    userId: z.string().transform(parseUserId),
    connectionId: connectionIdSchema,
    name: z.string(),
    scopes: z.array(z.string()),
    resources: connectionResourcesSchema.shape.kind,
    reads: z.literal("allow"),
    writes: z.literal("approval"),
  })
  .strict()

export type DelegateActor = z.infer<typeof delegateActorSchema>

export type Actor = PersonActor | CoachActor | DelegateActor

type SubjectKind = "chat" | "paper" | "job" | "inbox" | "account"

export type ActivityDraft = {
  subjectKind: SubjectKind
  subjectId: string
  summary: string
  detail?: unknown
}

export type ReversalExpect = {
  query: string
  input: unknown
  matches: Record<string, unknown>
  skipped: string
}

export type ReversalPlan = {
  command: string
  input: unknown
  expect?: ReversalExpect
} | null

export type CommandSpec<TInput, TOutput> = {
  delegate?: DelegateMarker
  writes?: (input: TInput) => ResourceRef[]
  name: string
  description: string
  input: ZodType<TInput>
  coach: CoachAccess
  destructive: boolean
  reversal: (input: TInput, output: NoInfer<TOutput>) => ReversalPlan
  step: (input: TInput) => string
  activity: (
    input: TInput,
    output: NoInfer<TOutput>,
    actor: Actor
  ) => ActivityDraft | null
  transaction?: "none"
  idempotency?: IdempotencyPolicy
}

export function defineCommand<TInput, TOutput>(
  spec: CommandSpec<TInput, TOutput>
): CommandSpec<TInput, TOutput> {
  if (spec.destructive && spec.coach === "auto") {
    throw new Error(
      `${spec.name} is destructive and cannot use coach access auto`
    )
  }
  return spec
}

export type QuerySpec<TInput, TOutput = unknown> = {
  name: string
  description: string
  input: ZodType<TInput>
  coach: boolean
  delegate?: DelegateMarker
  step: (input: TInput) => string
  read: (input: TInput, actor: Actor) => Promise<TOutput>
}

export function defineQuery<TInput, TOutput>(
  spec: QuerySpec<TInput, TOutput>
): QuerySpec<TInput, TOutput> {
  return spec
}

export function isCoachActor(actor: Actor): actor is CoachActor {
  return actor.type === "coach"
}
