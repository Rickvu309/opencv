import { useState } from "react"

import {
  AIM_OPTIONS,
  EMPTY_AIM_PROMPT_STATE,
  readAimPromptState,
  resolveAimPrompt,
  writeAimPromptState,
  type AimId,
} from "@/features/home/aim-prompt.ts"
import { authClient } from "@/lib/auth-client.ts"

export function useAimPrompt() {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const stored = userId ? readAimPromptState(userId) : EMPTY_AIM_PROMPT_STATE
  const [sessionResolved, setSessionResolved] = useState(false)

  function resolve(aimId: AimId | null) {
    if (!userId) return
    writeAimPromptState(userId, resolveAimPrompt(stored, aimId))
    setSessionResolved(true)
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
    },
  }
}
