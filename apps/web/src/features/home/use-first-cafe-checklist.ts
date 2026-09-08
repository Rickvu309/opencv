import { useEffect, useState } from "react"

import {
  EMPTY_FIRST_CAFE_STATE,
  FIRST_CAFE_CHECKLIST_ITEMS,
  dismissFirstCafeChecklist,
  readFirstCafeState,
  writeFirstCafeState,
  type FirstCafeState,
} from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

export function useFirstCafeChecklist() {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const [state, setState] = useState<FirstCafeState>(EMPTY_FIRST_CAFE_STATE)

  useEffect(() => {
    if (!userId) {
      setState(EMPTY_FIRST_CAFE_STATE)
      return
    }
    setState(readFirstCafeState(userId))
  }, [userId])

  function dismiss() {
    if (!userId) return
    const next = dismissFirstCafeChecklist(state)
    writeFirstCafeState(userId, next)
    setState(next)
  }

  return {
    visible: Boolean(userId) && !state.dismissed,
    completed: state.completed,
    items: FIRST_CAFE_CHECKLIST_ITEMS,
    dismiss,
  }
}
