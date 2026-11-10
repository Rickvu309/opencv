type Listener = () => void

const refreshers = new Set<Listener>()

export function subscribeWritingRefresh(listener: Listener) {
  refreshers.add(listener)
  return () => {
    refreshers.delete(listener)
  }
}

export function notifyWritingRefresh() {
  for (const listener of refreshers) listener()
}

export const WRITING_CONFLICT_NOTE =
  "This page changed while you had unsent words. Your words are still here."

let conflictDoc: string | null = null
const conflictListeners = new Set<Listener>()

export function subscribeWritingConflict(listener: Listener) {
  conflictListeners.add(listener)
  return () => {
    conflictListeners.delete(listener)
  }
}

export function writingConflictDoc() {
  return conflictDoc
}

export function setWritingConflict(docId: string | null) {
  if (conflictDoc === docId) return
  conflictDoc = docId
  for (const listener of conflictListeners) listener()
}
