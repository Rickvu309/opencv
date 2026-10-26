import {
  type CoachMode,
  type ProfileUpdateInput,
  type UserProfile,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export const profileQueryKeys = {
  current: () => ["profile"] as const,
}

export async function getProfile(): Promise<UserProfile> {
  const body = await apiFetch<SuccessBody<UserProfile>>("/api/profile")
  return unwrapData(body)
}

export async function setCoachMode(mode: CoachMode): Promise<UserProfile> {
  const body = await apiFetch<SuccessBody<UserProfile>>(
    "/api/commands/profile.update",
    {
      method: "POST",
      body: JSON.stringify({ coachMode: mode } satisfies ProfileUpdateInput),
    }
  )
  return unwrapData(body)
}
