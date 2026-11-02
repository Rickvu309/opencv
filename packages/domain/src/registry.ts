import type { ZodType } from "zod"

import { parseChatId, parseUserId, type ChatId, type UserId } from "./ids.js"
import type { IdempotencyPolicy } from "./contract.js"

export type CoachAccess = "auto" | "confirm" | "never"

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

export type Actor = PersonActor | CoachActor

type SubjectKind = "chat" | "paper" | "job" | "inbox" | "account"

export type ActivityDraft = {
  subjectKind: SubjectKind
  subjectId: string
  summary: string
  detail?: unknown
}

export type ReversalPlan = {
  command: string
  input: unknown
} | null

export type CommandSpec<TInput, TOutput> = {
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
