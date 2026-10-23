import {
  PROFILE_COMMANDS,
  type CoachMode,
  type ProfileSetCoachModeInput,
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
    `/api/commands/${PROFILE_COMMANDS.setCoachMode}`,
    {
      method: "POST",
      body: JSON.stringify({ mode } satisfies ProfileSetCoachModeInput),
    }
  )
  return unwrapData(body)
}
