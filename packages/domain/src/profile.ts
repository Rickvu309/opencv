import { z } from "zod"

import {
  coachModeSchema,
  DEFAULT_COACH_MODE,
  type CoachMode,
} from "./coach.js"

/** Same public fields GET /api/profile returns. */
export const profileGetInputSchema = z.object({}).strict()

export type ProfileGetInput = z.infer<typeof profileGetInputSchema>

export const profileSetCoachModeInputSchema = z
  .object({
    mode: coachModeSchema,
  })
  .strict()

export type ProfileSetCoachModeInput = z.infer<
  typeof profileSetCoachModeInputSchema
>

export type UserProfile = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  coachMode: CoachMode
  createdAt: string
  updatedAt: string
}

export function parseCoachMode(value: unknown): CoachMode {
  const parsed = coachModeSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_COACH_MODE
}