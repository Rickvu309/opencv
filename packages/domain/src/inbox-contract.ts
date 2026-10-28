import { z } from "zod"

import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"
import { jobStageSchema } from "./job.js"
import type { QueryRef } from "./queries.js"

const inboxStatusSchema = z.enum(["open", "done", "snoozed"])

const suggestedStageSchema = z.enum(["interview"]).nullable()

const inboxThreadSchema = z
  .object({
    id: z.string(),
    company: z.string(),
    role: z.string(),
    summary: z.string(),
    lastMessageAt: z.string().datetime(),
    unread: z.boolean(),
    suggestedStage: suggestedStageSchema,
    jobId: z.string().nullable(),
    status: inboxStatusSchema,
  })
  .strict()

export type InboxThread = z.output<typeof inboxThreadSchema>

const inboxListSchema = z
  .object({
    connected: z.boolean(),
    skipped: z.boolean(),
    timeZone: z.string(),
    threads: z.array(inboxThreadSchema),
  })
  .strict()

const inboxMessageSchema = z
  .object({
    id: z.string(),
    direction: z.enum(["in", "out"]),
    fromName: z.string(),
    fromEmail: z.string(),
    toEmail: z.string(),
    bodyText: z.string(),
    sentAt: z.string().datetime(),
  })
  .strict()

const draftSchema = z
  .object({ body: z.string(), times: z.array(z.string()) })
  .strict()

const inboxDetailSchema = inboxThreadSchema
  .extend({
    subject: z.string(),
    messages: z.array(inboxMessageSchema),
    draft: draftSchema.nullable(),
    job: z
      .object({ id: z.string(), title: z.string(), stage: jobStageSchema })
      .strict()
      .nullable(),
    openUrl: z.string().nullable(),
  })
  .strict()

export type InboxDetail = z.output<typeof inboxDetailSchema>

const threadIdSchema = z.string().uuid()
const emptyInput = z.object({}).strict()
const threadInput = z.object({ threadId: threadIdSchema }).strict()

export const inboxQueries = queryContract({
  "inbox.list": queryEntry({ input: emptyInput, output: inboxListSchema }),
  "inbox.get": queryEntry({ input: threadInput, output: inboxDetailSchema }),
})

const listChanged = (): QueryRef[] => [{ query: "inbox.list" }]

const threadChanged = (input: { threadId: string }): QueryRef[] => [
  { query: "inbox.get", input: { threadId: input.threadId } },
]

const listAndThreadChanged = (input: { threadId: string }): QueryRef[] => [
  ...listChanged(),
  ...threadChanged(input),
]

const draftOutput = z
  .object({ id: z.string(), body: z.string(), times: z.array(z.string()) })
  .strict()

const statusOutput = z
  .object({
    id: z.string(),
    previousStatus: inboxStatusSchema,
    previousSnoozeUntil: z.string().datetime().nullable(),
  })
  .strict()

export const inboxContract = commandContract({
  "inbox.skip": commandEntry({
    description: "Skip Gmail for now.",
    input: emptyInput,
    output: z.object({ skipped: z.literal(true) }).strict(),
    coach: "never",
    destructive: false,
    step: () => "Skip inbox for now",
    invalidates: listChanged,
  }),
  "inbox.scan": commandEntry({
    description: "Read job emails from the mail provider.",
    input: emptyInput,
    output: z
      .object({
        threads: z.array(inboxThreadSchema),
        emailCount: z.number().int(),
        companyCount: z.number().int(),
      })
      .strict(),
    coach: "auto",
    destructive: false,
    step: () => "Scan job emails",
    invalidates: listChanged,
  }),
  "inbox.markDone": commandEntry({
    description: "Mark an email done.",
    input: z
      .object({
        threadId: threadIdSchema,
        status: inboxStatusSchema.optional(),
      })
      .strict(),
    output: statusOutput,
    coach: "auto",
    destructive: false,
    step: () => "Mark the email done",
    invalidates: listAndThreadChanged,
  }),
  "inbox.snooze": commandEntry({
    description: "Snooze an email until a time.",
    input: z
      .object({
        threadId: threadIdSchema,
        until: z.string().datetime().nullable(),
      })
      .strict(),
    output: statusOutput,
    coach: "auto",
    destructive: false,
    step: () => "Snooze the email",
    invalidates: listAndThreadChanged,
  }),
  "inbox.clearSuggestion": commandEntry({
    description: "Dismiss a stage suggestion.",
    input: threadInput,
    output: z
      .object({ id: z.string(), previousStage: suggestedStageSchema })
      .strict(),
    coach: "never",
    destructive: false,
    step: () => "Dismiss the suggestion",
    invalidates: listAndThreadChanged,
  }),
  "inbox.acceptSuggestion": commandEntry({
    description: "Move the linked job to the suggested stage.",
    input: threadInput,
    output: z
      .object({
        id: z.string(),
        jobId: z.string(),
        stage: z.literal("interview"),
        activityId: z.string(),
      })
      .strict(),
    coach: "never",
    destructive: false,
    step: () => "Move the job to Interview",
    invalidates: (input) => [
      ...listAndThreadChanged(input),
      { query: "job.list" },
      { query: "job.get" },
      { query: "job.calendar" },
    ],
  }),
  "inbox.draftReply": commandEntry({
    description: "Draft a reply. A hint asks the Coach for another one.",
    input: z
      .object({
        threadId: threadIdSchema,
        hint: z.string().trim().min(1).max(8000).optional(),
      })
      .strict(),
    output: draftOutput,
    coach: "auto",
    destructive: false,
    step: () => "Draft a reply",
    invalidates: threadChanged,
  }),
  "inbox.updateDraft": commandEntry({
    description: "Save an edited reply.",
    input: z
      .object({ threadId: threadIdSchema, body: z.string().max(20_000) })
      .strict(),
    output: draftOutput,
    coach: "never",
    destructive: false,
    step: () => "Update the draft",
    invalidates: threadChanged,
  }),
  "inbox.send": commandEntry({
    description: "Send the drafted reply.",
    input: threadInput,
    output: z
      .object({ id: z.string(), threadId: z.string(), body: z.string() })
      .strict(),
    coach: "never",
    destructive: true,
    step: () => "Send the reply",
    invalidates: listAndThreadChanged,
  }),
  "inbox.addToCalendar": commandEntry({
    description: "Add the selected time to the calendar.",
    input: z
      .object({ threadId: threadIdSchema, start: z.string().datetime() })
      .strict(),
    output: z
      .object({
        id: z.string(),
        threadId: z.string(),
        start: z.string().datetime(),
      })
      .strict(),
    coach: "never",
    destructive: false,
    step: () => "Add the time to the calendar",
    invalidates: () => [],
  }),
})

export type InboxContract = typeof inboxContract
