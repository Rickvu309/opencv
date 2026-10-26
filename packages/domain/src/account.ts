import { z } from "zod"

import { coachModeSchema } from "./coach.js"
import { fileIdSchema } from "./ids.js"
import type { Plan } from "./usage.js"

export const planSchema = z.enum(["free", "pro"])
export const languageSchema = z.enum(["en", "vi"])
export const startPageSchema = z.enum(["apply", "paper", "inbox", "coach"])

export const PROFILE_DEFAULTS = {
  plan: "free",
  coachMode: "free",
  language: "en",
  timeZone: "Asia/Ho_Chi_Minh",
  startPage: "apply",
  notifyEmail: true,
  notifyBrowser: false,
  memoryEnabled: true,
  agentChat: true,
  agentCvs: true,
  agentInterview: true,
  agentEmail: true,
  agentWeekly: false,
} as const satisfies {
  plan: Plan
  coachMode: "free"
  language: "en" | "vi"
  timeZone: string
  startPage: "apply" | "paper" | "inbox" | "coach"
  notifyEmail: boolean
  notifyBrowser: boolean
  memoryEnabled: boolean
  agentChat: boolean
  agentCvs: boolean
  agentInterview: boolean
  agentEmail: boolean
  agentWeekly: boolean
}

export const ACCOUNT_DELETE_CONFIRM = "DELETE"
export const PLAN_REQUIRED_MESSAGE =
  "Light and Max need Pro. Stay on Free, or upgrade to change mode."

export const profileUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    language: languageSchema.optional(),
    timeZone: z.string().trim().min(1).max(80).optional(),
    startPage: startPageSchema.optional(),
    notifyEmail: z.boolean().optional(),
    notifyBrowser: z.boolean().optional(),
    memoryEnabled: z.boolean().optional(),
    coachMode: coachModeSchema.optional(),
    agentChat: z.boolean().optional(),
    agentCvs: z.boolean().optional(),
    agentInterview: z.boolean().optional(),
    agentEmail: z.boolean().optional(),
    agentWeekly: z.boolean().optional(),
  })
  .strict()

export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>

export const profileMarkWelcomedInputSchema = z.object({}).strict()

export type ProfileMarkWelcomedInput = z.infer<
  typeof profileMarkWelcomedInputSchema
>

export const profileSetPhotoInputSchema = z
  .object({
    fileId: fileIdSchema,
  })
  .strict()

export type ProfileSetPhotoInput = z.infer<typeof profileSetPhotoInputSchema>

export const accountRequestEmailChangeInputSchema = z
  .object({
    email: z.string().trim().email(),
  })
  .strict()

export type AccountRequestEmailChangeInput = z.infer<
  typeof accountRequestEmailChangeInputSchema
>

export const accountDeleteInputSchema = z
  .object({
    confirm: z.literal(ACCOUNT_DELETE_CONFIRM),
  })
  .strict()

export type AccountDeleteInput = z.infer<typeof accountDeleteInputSchema>

export const notifyTopicSchema = z.enum(["jobs", "proof"])
export type NotifyTopic = z.infer<typeof notifyTopicSchema>

export const notifyRequestInputSchema = z
  .object({
    topic: notifyTopicSchema,
  })
  .strict()

export type NotifyRequestInput = z.infer<typeof notifyRequestInputSchema>

export function isKnownTimeZone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}
