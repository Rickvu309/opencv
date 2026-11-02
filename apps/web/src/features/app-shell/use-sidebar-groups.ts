import { useReducer } from "react"

import { readStored, writeStored } from "@/lib/local-storage.ts"

const CLOSED_KEY = "opencv.sidebar.closed"

type GroupAction = { type: "opened" } | { type: "closed" }

function groupReducer(_open: boolean, action: GroupAction) {
  return action.type === "opened"
}

function parseClosed(raw: string | null): string[] {
  const parsed: unknown = raw ? JSON.parse(raw) : []
  return Array.isArray(parsed)
    ? parsed.filter((id): id is string => typeof id === "string")
    : []
}

function readClosed() {
  return readStored(CLOSED_KEY, parseClosed, [])
}

export function useSidebarGroup(id: string) {
  const [open, dispatch] = useReducer(
    groupReducer,
    id,
    (groupId) => !readClosed().includes(groupId)
  )

  function toggle() {
    const closed = readClosed().filter((entry) => entry !== id)
    writeStored(CLOSED_KEY, JSON.stringify(open ? [...closed, id] : closed))
    dispatch({ type: open ? "closed" : "opened" })
  }

  return { open, toggle }
}
