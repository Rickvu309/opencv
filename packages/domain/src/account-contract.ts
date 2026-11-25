import { z } from "zod"

import { planSchema, profileSchema } from "./account.js"
import { coachModeSchema } from "./coach.js"
import { queryContract, queryEntry } from "./contract.js"

const emptyInput = z.object({}).strict()

const cappedWindowSchema = z.discriminatedUnion("capped", [
  z
    .object({
      capped: z.literal(true),
      percent: z.number(),
      resetsAt: z.string(),
    })
    .strict(),
  z.object({ capped: z.literal(false), resetsAt: z.string() }).strict(),
])

const dayUsageSchema = z.discriminatedUnion("capped", [
  z
    .object({
      capped: z.literal(true),
      used: z.number(),
      cap: z.number(),
      remaining: z.number(),
      resetsAt: z.string(),
    })
    .strict(),
  z.object({ capped: z.literal(false), resetsAt: z.string() }).strict(),
])

const usageSnapshotSchema = z
  .object({
    plan: planSchema,
    mode: coachModeSchema,
    session: cappedWindowSchema,
    day: dayUsageSchema,
    week: cappedWindowSchema,
  })
  .strict()

const activityFeedRowSchema = z
  .object({
    id: z.string(),
    createdAt: z.string().datetime(),
    actor: z.string(),
    command: z.string(),
    subjectKind: z.string(),
    subjectId: z.string(),
    summary: z.string(),
    undoneAt: z.string().datetime().nullable(),
    reversible: z.boolean(),
  })
  .strict()

export type ActivityFeedRow = z.output<typeof activityFeedRowSchema>

export const accountQueries = queryContract({
  "profile.get": queryEntry({ input: emptyInput, output: profileSchema }),
  "coach.usage": queryEntry({
    input: emptyInput,
    output: usageSnapshotSchema,
  }),
  "activity.list": queryEntry({
    input: z
      .object({
        subjectKind: z.string().min(1).optional(),
        subjectId: z.string().min(1).optional(),
      })
      .strict(),
    output: z.array(activityFeedRowSchema),
  }),
})
