import {
  PITCH_COMMANDS,
  type PitchDoc,
  type PitchDocument,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"

export const pitchQueryKeys = {
  current: () => ["pitch"] as const,
}

type SuccessBody<T> = {
  ok: true
  data: T
}

function unwrapData<T>(body: SuccessBody<T>): T {
  return body.data
}

export async function getPitch(): Promise<PitchDoc> {
  const body = await apiFetch<SuccessBody<PitchDoc>>("/api/pitch")
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
