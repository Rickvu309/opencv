import { useState } from "react"

import {
  EMPTY_AIM_PROMPT_STATE,
  readAimPromptState,
} from "@/features/home/aim-prompt.ts"
import {
  EMPTY_FIRST_CAFE_STATE,
  FIRST_CAFE_CHECKLIST_ITEMS,
  dismissFirstCafeChecklist,
  nextFirstCafeNudge,
  readFirstCafeState,
  requiredFirstCafeItemsDone,
  skipFirstCafeNudge,
  writeFirstCafeState,
} from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

export function useFirstCafeChecklist(opts?: { aimResolved?: boolean }) {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const stored = userId ? readFirstCafeState(userId) : EMPTY_FIRST_CAFE_STATE
  const storedAim = userId ? readAimPromptState(userId) : EMPTY_AIM_PROMPT_STATE
  const aimResolved = opts?.aimResolved ?? storedAim.resolved
  const [sessionDismissed, setSessionDismissed] = useState(false)
  const [sessionNudgeSkipped, setSessionNudgeSkipped] = useState(false)

  function dismiss() {
    if (!userId) return
    writeFirstCafeState(userId, dismissFirstCafeChecklist(stored))
    setSessionDismissed(true)
  }

  function skipNudge() {
    if (!userId) return
    writeFirstCafeState(userId, skipFirstCafeNudge(stored))
    setSessionNudgeSkipped(true)
  }

  const nudge =
    userId == null
      ? null
      : nextFirstCafeNudge({
          completed: stored.completed,
          nudgeSkipped: stored.nudgeSkipped || sessionNudgeSkipped,
          extraWins: stored.wins,
          aimResolved,
        })

  const requiredDone = requiredFirstCafeItemsDone(stored.completed)

  return {
    visible:
      Boolean(userId) &&
      !stored.dismissed &&
      !sessionDismissed &&
      !requiredDone,
    completed: stored.completed,
    items: FIRST_CAFE_CHECKLIST_ITEMS,
    dismiss,
    nudge,
    skipNudge,
  }
}
