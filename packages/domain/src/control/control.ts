import { z } from "zod"

import type { ResourceRef } from "../resources.js"

export const activityRowAsTheApiReturnsIt = z
  .object({
    id: z.string(),
    userId: z.string(),
    createdAt: z.string().datetime(),
    actor: z.enum(["person", "coach", "delegate"]),
    command: z.string(),
    subjectKind: z.string(),
    subjectId: z.string(),
    summary: z.string(),
    detail: z.unknown(),
    result: z.unknown(),
    reversalCommand: z.string().nullable(),
    reversalInput: z.unknown(),
    reversalExpect: z.unknown(),
    undoneAt: z.string().datetime().nullable(),
    idempotencyKey: z.string().nullable(),
    turnId: z.string().nullable(),
  })
  .strict()

export type ActivityRow = z.output<typeof activityRowAsTheApiReturnsIt>

export const pendingActionRowSchema = z
  .object({
    delegateConnectionId: z.string().uuid().nullable(),
    id: z.string(),
    userId: z.string(),
    chatId: z.string(),
    command: z.string(),
    input: z.unknown(),
    summary: z.string(),
    status: z.enum(["pending", "approved", "denied", "expired"]),
    turnId: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict()

export type PendingActionRow = z.output<typeof pendingActionRowSchema>

export const everyReadAnUndoOrApprovalCanChange: ResourceRef = {
  name: "workspace",
  coachFloor: "never",
}
