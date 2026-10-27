import { z } from "zod"

import {
  accountDeleteInputSchema,
  accountRequestEmailChangeInputSchema,
  languageSchema,
  notifyRequestInputSchema,
  notifyTopicSchema,
  planSchema,
  profileMarkWelcomedInputSchema,
  profileSetPhotoInputSchema,
  profileUpdateInputSchema,
  startPageSchema,
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

export const profileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    plan: planSchema,
    coachMode: coachModeSchema,
    language: languageSchema,
    timeZone: z.string(),
    startPage: startPageSchema,
    notifyEmail: z.boolean(),
    notifyBrowser: z.boolean(),
    memoryEnabled: z.boolean(),
    agentChat: z.boolean(),
    agentCvs: z.boolean(),
    agentInterview: z.boolean(),
    agentEmail: z.boolean(),
    agentWeekly: z.boolean(),
    welcomedAt: z.string().datetime().nullable(),
    inboxSkippedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Profile = z.output<typeof profileSchema>

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

export const usageSnapshotSchema = z
  .object({
    plan: planSchema,
    mode: coachModeSchema,
    session: cappedWindowSchema,
    day: dayUsageSchema,
    week: cappedWindowSchema,
  })
  .strict()

export const integrationStatusSchema = z.enum([
  "enabled",
  "disabled",
  "unavailable",
])

export const integrationsSchema = z
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

export const billingSchema = z
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

export const activityFeedRowSchema = z
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

// A plan or Coach mode change moves what the usage and billing views show.
const profileChanged = (): QueryRef[] => [
  { query: "profile.get" },
  { query: "billing.get" },
  { query: "coach.usage" },
]

const nothingChanged = (): QueryRef[] => []

export const accountContract = commandContract({
  "profile.update": commandEntry({
    description: "Update profile, plan mode, and agent settings.",
    input: profileUpdateInputSchema,
    output: profileSchema,
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Update profile",
    invalidates: profileChanged,
  }),
  "profile.markWelcomed": commandEntry({
    description: "Record that the welcome screen finished.",
    input: profileMarkWelcomedInputSchema,
    output: profileSchema,
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Mark welcomed",
    invalidates: profileChanged,
  }),
  "profile.setPhoto": commandEntry({
    description: "Set the profile photo from an uploaded file.",
    input: profileSetPhotoInputSchema,
    output: profileSchema,
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Set photo",
    invalidates: profileChanged,
  }),
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
