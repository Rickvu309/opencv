import {
  PITCH_COMMANDS,
  type PitchDoc,
  type PitchDocument,
  type PublicPitch,
} from "@workspace/domain"

import { apiBaseUrl, apiFetch } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export const pitchQueryKeys = {
  current: () => ["pitch"] as const,
  public: (slug: string) => ["pitch", "public", slug] as const,
}

export async function getPitch(): Promise<PitchDoc> {
  const body = await apiFetch<SuccessBody<PitchDoc>>("/api/pitch")
  return unwrapData(body)
}

export async function getPublicPitch(slug: string): Promise<PublicPitch> {
  const response = await fetch(
    new URL(`/api/pitch/public/${encodeURIComponent(slug)}`, apiBaseUrl),
    {
      credentials: "omit",
    }
  )
  if (!response.ok)
    throw new ApiError(
      response.status,
      "PITCH_UNAVAILABLE",
      "Pitch could not be loaded."
    )
  const body: SuccessBody<PublicPitch> = await response.json()
  return unwrapData(body)
}

export function updatePitch(input: {
  content: PitchDocument
  contentVersion: number
}): Promise<PitchDoc> {
  return apiFetch<SuccessBody<PitchDoc>>(
    `/api/commands/${PITCH_COMMANDS.update}`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  ).then(unwrapData)
}
