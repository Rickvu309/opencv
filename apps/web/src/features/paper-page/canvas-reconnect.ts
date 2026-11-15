import { useEffect, useReducer } from "react"

import { pendingSent } from "./canvas-save-record.ts"
import { serial } from "./canvas-save.ts"

export function useWritingReconnect(docId: string, enabled: boolean) {
  const [connection, wake] = useReducer((value: number) => value + 1, 0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    let checking = false
    const online = () => {
      if (checking) return
      checking = true
      void serial(docId, () => pendingSent(docId)).then((pending) => {
        checking = false
        if (active && pending) wake()
      })
    }
    window.addEventListener("online", online)
    return () => {
      active = false
      window.removeEventListener("online", online)
    }
  }, [docId, enabled])
  return connection
}
