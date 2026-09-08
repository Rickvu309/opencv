import { useState } from "react"

import {
  EMPTY_FIRST_CAFE_STATE,
  FIRST_CAFE_CHECKLIST_ITEMS,
  dismissFirstCafeChecklist,
  nextFirstCafeNudge,
  readFirstCafeState,
  skipFirstCafeNudge,
  writeFirstCafeState,
} from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

export function useFirstCafeChecklist() {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const stored = userId ? readFirstCafeState(userId) : EMPTY_FIRST_CAFE_STATE
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

  const nudge = nextFirstCafeNudge({
    completed: stored.completed,
    nudgeSkipped: stored.nudgeSkipped || sessionNudgeSkipped,
    extraWins: stored.wins,
  })

  return {
    visible: Boolean(userId) && !stored.dismissed && !sessionDismissed,
    completed: stored.completed,
    items: FIRST_CAFE_CHECKLIST_ITEMS,
    dismiss,
    nudge,
    skipNudge,
  }
}
