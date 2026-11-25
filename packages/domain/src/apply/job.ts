import { z } from "zod"

import {
  idResult,
  jobIdSchema,
  paperIdSchema,
  type JobId,
  type PaperId,
} from "../ids.js"
import type { ResourceRef } from "../resources.js"

const JOB_STAGES = ["saved", "applied", "interview", "offer", "closed"] as const

export const jobStageSchema = z.enum(JOB_STAGES)
export type JobStage = z.infer<typeof jobStageSchema>

export const jobPrioritySchema = z.enum(["low", "normal", "high"])
export type JobPriority = z.infer<typeof jobPrioritySchema>

export const COMPANY_REQUIRED_MESSAGE = "Add the company name to save this job."
export const DUPLICATE_JOB_MESSAGE = "You already saved a job with this link."

export const jobCreateInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    company: z.string().trim().max(200).optional(),
    stage: jobStageSchema.optional(),
    description: z.string().max(20_000).optional(),
    jobUrl: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(200).optional(),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    sourceHost: z.string().trim().max(200).optional(),
    anyway: z.boolean().optional(),
  })
  .strict()

export type JobCreateInput = z.infer<typeof jobCreateInputSchema>

const jobPostingSchema = z
  .object({
    about: z.string(),
    duties: z.string(),
    requirements: z.string(),
    details: z.string(),
  })
  .strict()

const nullableText = z.string().nullable()

export const jobViewSchema = z
  .object({
    id: jobIdSchema,
    title: z.string(),
    company: z.string(),
    stage: jobStageSchema,
    position: z.string(),
    location: nullableText,
    priority: jobPrioritySchema,
    jobUrl: nullableText,
    sourceHost: nullableText,
    description: nullableText,
    posting: jobPostingSchema.nullable(),
    interviewAt: z.string().datetime().nullable(),
    deadline: nullableText,
    recruiterName: nullableText,
    recruiterEmail: nullableText,
    cvDocId: paperIdSchema.nullable(),
    letterDocId: paperIdSchema.nullable(),
    starred: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type JobView = z.output<typeof jobViewSchema>

export const jobPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    company: z.string().trim().min(1).max(200).optional(),
    location: z.string().trim().max(200).nullable().optional(),
    priority: jobPrioritySchema.optional(),
    interviewAt: z.string().datetime().nullable().optional(),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    recruiterName: z.string().trim().max(200).nullable().optional(),
    recruiterEmail: z.string().trim().email().nullable().optional(),
    description: z.string().max(20_000).nullable().optional(),
    jobUrl: z.string().trim().max(2000).nullable().optional(),
    posting: jobPostingSchema.nullable().optional(),
  })
  .strict()

export type JobPatch = z.infer<typeof jobPatchSchema>

export const JOB_ACTIVITY_PATCH_KEYS = [
  "interviewAt",
  "deadline",
  "priority",
  "recruiterName",
  "recruiterEmail",
  "location",
] as const

export const jobUpdateInputSchema = z
  .object({
    jobId: jobIdSchema,
    patch: jobPatchSchema,
  })
  .strict()

export const jobMoveInputSchema = z
  .object({
    jobId: jobIdSchema,
    stage: jobStageSchema,
    position: z.string().min(1).max(200).optional(),
  })
  .strict()

export const jobStarInputSchema = z
  .object({
    jobId: jobIdSchema,
    starred: z.boolean(),
  })
  .strict()

export const jobDeleteInputSchema = z
  .object({
    jobId: jobIdSchema,
  })
  .strict()

export const jobAddChecklistItemInputSchema = z
  .object({
    jobId: jobIdSchema,
    label: z.string().trim().min(1).max(200),
  })
  .strict()

export const jobSetChecklistItemInputSchema = z
  .object({
    jobId: jobIdSchema,
    itemId: z.string().uuid(),
    done: z.boolean(),
  })
  .strict()

export const jobRemoveChecklistItemInputSchema = z
  .object({
    jobId: jobIdSchema,
    itemId: z.string().uuid(),
  })
  .strict()

export const jobAddNoteInputSchema = z
  .object({
    jobId: jobIdSchema,
    body: z.string().trim().max(4000),
  })
  .strict()

export const jobLinkPaperInputSchema = z
  .object({
    jobId: jobIdSchema,
    docId: paperIdSchema,
    kind: z.enum(["cv", "letter"]),
  })
  .strict()

export const jobUnlinkPaperInputSchema = z
  .object({
    jobId: jobIdSchema,
    kind: z.enum(["cv", "letter"]),
  })
  .strict()

type ParsedUrl = {
  hash: string
  pathname: string
  protocol: string
  host: string
  search: string
}

function parseUrl(value: string): ParsedUrl | null {
  const Url = (globalThis as { URL?: new (input: string) => ParsedUrl }).URL
  if (!Url) return null
  try {
    return new Url(value)
  } catch {
    return null
  }
}

export function normalizeJobUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const url = parseUrl(trimmed)
  if (!url) return trimmed.toLowerCase().replace(/\/+$/, "")
  url.hash = ""
  const path = url.pathname.replace(/\/+$/, "") || "/"
  return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`
}

export function sourceHostFromUrl(value: string | undefined) {
  if (!value) return null
  return parseUrl(value)?.host.toLowerCase() ?? null
}

export const jobResultSchema = jobViewSchema
  .extend({
    id: idResult<JobId>(),
    cvDocId: idResult<PaperId>().nullable(),
    letterDocId: idResult<PaperId>().nullable(),
  })
  .strip()

export function jobResource(jobId?: string): ResourceRef {
  return {
    name: "job",
    coachFloor: "auto",
    ...(jobId ? { entityId: jobId } : {}),
  }
}

const previewFieldsSchema = z
  .object({ title: z.string(), company: z.string(), location: z.string() })
  .strict()

export const jobPreviewSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("unreadable"),
      fields: z.object({}).strict(),
      message: z.string(),
    })
    .strict(),
  z
    .object({
      status: z.literal("duplicate"),
      jobId: idResult<JobId>(),
      stage: jobStageSchema,
      fields: previewFieldsSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("company-missing"),
      fields: previewFieldsSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("filled"),
      fields: previewFieldsSchema.extend({ description: z.string() }).strict(),
    })
    .strict(),
])

export type JobPreview = z.output<typeof jobPreviewSchema>

const linkedPaperSchema = z
  .object({ id: idResult<PaperId>(), name: z.string() })
  .strict()
  .nullable()

const jobChecklistItemSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    done: z.boolean(),
    position: z.string(),
  })
  .strict()

export const jobDetailSchema = jobResultSchema
  .extend({
    note: z.string(),
    checklist: z.array(jobChecklistItemSchema),
    linked: z
      .object({ cv: linkedPaperSchema, letter: linkedPaperSchema })
      .strict(),
  })
  .strict()

export type JobDetail = z.output<typeof jobDetailSchema>
