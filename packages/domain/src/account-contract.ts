import { z } from "zod"

import {
  accountDeleteInputSchema,
  accountRequestEmailChangeInputSchema,
  notifyRequestInputSchema,
  notifyTopicSchema,
  planSchema,
  profileSchema,
} from "./account.js"
import { coachModeSchema } from "./coach.js"
import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"
import type { QueryRef } from "./queries.js"

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

const integrationStatusSchema = z.enum(["enabled", "disabled", "unavailable"])

const integrationsSchema = z
  .object({
    groups: z.array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          items: z.array(
            z
              .object({
                id: z.string(),
                name: z.string(),
                line: z.string(),
                status: integrationStatusSchema,
              })
              .strict()
          ),
        })
        .strict()
    ),
  })
  .strict()

const billingSchema = z
  .object({
    plan: planSchema,
    free: z.object({ price: z.string(), line: z.string() }).strict(),
    pro: z
      .object({
        price: z.string(),
        line: z.string(),
        benefits: z.array(z.string()).readonly(),
      })
      .strict(),
    payment: z.null(),
    invoices: z.array(z.never()),
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
  "integrations.list": queryEntry({
    input: emptyInput,
    output: integrationsSchema,
  }),
  "billing.get": queryEntry({ input: emptyInput, output: billingSchema }),
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

const nothingChanged = (): QueryRef[] => []

export const accountContract = commandContract({
  "account.requestEmailChange": commandEntry({
    description: "Ask for a code to change the sign-in email.",
    input: accountRequestEmailChangeInputSchema,
    output: z
      .object({
        email: z.string(),
        sent: z.boolean(),
        message: z.string().optional(),
      })
      .strict(),
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Request email change",
    invalidates: nothingChanged,
  }),
  "account.delete": commandEntry({
    description: "Delete the account and every row it owns.",
    input: accountDeleteInputSchema,
    output: z.object({ deleted: z.literal(true) }).strict(),
    idempotency: "none",
    coach: "never",
    destructive: true,
    step: () => "Delete account",
    invalidates: nothingChanged,
  }),
  "notify.request": commandEntry({
    description: "Ask to hear when a topic is ready.",
    input: notifyRequestInputSchema,
    output: z
      .object({
        id: z.string(),
        topic: notifyTopicSchema,
        createdAt: z.string().datetime(),
      })
      .strict(),
    coach: "auto",
    destructive: false,
    step: (input) => `Notify me about ${input.topic}`,
    invalidates: nothingChanged,
  }),
})

export type AccountContract = typeof accountContract
