import { useState } from "react"

import {
  EMPTY_FIRST_CAFE_STATE,
  FIRST_CAFE_CHECKLIST_ITEMS,
  dismissFirstCafeChecklist,
  readFirstCafeState,
  writeFirstCafeState,
} from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

export function useFirstCafeChecklist() {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const stored = userId ? readFirstCafeState(userId) : EMPTY_FIRST_CAFE_STATE
  const [sessionDismissed, setSessionDismissed] = useState(false)

  function dismiss() {
    if (!userId) return
    writeFirstCafeState(userId, dismissFirstCafeChecklist(stored))
    setSessionDismissed(true)
  }

  return {
    visible: Boolean(userId) && !stored.dismissed && !sessionDismissed,
    completed: stored.completed,
    items: FIRST_CAFE_CHECKLIST_ITEMS,
    dismiss,
  }
}
