import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { decodePitchContent } from "@workspace/domain"

import {
  AIM_OPTIONS,
  EMPTY_AIM_PROMPT_STATE,
  applyAimToPitchHeadline,
  readAimPromptState,
  resolveAimPrompt,
  writeAimPromptState,
  type AimId,
} from "@/features/home/aim-prompt.ts"
import {
  getPitch,
  pitchQueryKeys,
  updatePitch,
} from "@/features/pitch/pitch-api.ts"
import { authClient } from "@/lib/auth-client.ts"

export function useAimPrompt() {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const queryClient = useQueryClient()
  const stored = userId ? readAimPromptState(userId) : EMPTY_AIM_PROMPT_STATE
  const [sessionResolved, setSessionResolved] = useState(false)

  function resolve(aimId: AimId | null) {
    if (!userId) return
    writeAimPromptState(userId, resolveAimPrompt(stored, aimId))
    setSessionResolved(true)
  }

  async function feedAim(aimId: AimId) {
    try {
      const doc = await getPitch()
      const decoded = decodePitchContent(
        doc.kind,
        doc.contentVersion,
        doc.content
      )
      if (!decoded.ok) return
      const next = applyAimToPitchHeadline(decoded.data, aimId)
      if (!next) return
      const updated = await updatePitch({
        content: next,
        contentVersion: doc.contentVersion,
      })
      queryClient.setQueryData(pitchQueryKeys.current(), updated)
    } catch {
      // Skip already happened. Pitch headline is a soft hint.
    }
  }

  const resolved = Boolean(userId) && (stored.resolved || sessionResolved)

  return {
    visible: Boolean(userId) && !resolved,
    resolved,
    options: AIM_OPTIONS,
    skip() {
      resolve(null)
    },
    choose(aimId: AimId) {
      resolve(aimId)
      void feedAim(aimId)
    },
  }
}
