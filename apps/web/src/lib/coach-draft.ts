const UNREAD_DRAFT_LIFETIME_MS = 500

let unreadDraft: string | null = null
let draftForStrictModeReread: string | null = null
let expiry: number | undefined
const listeners = new Set<(text: string) => void>()

export function publishCoachDraft(text: string) {
  unreadDraft = text
  draftForStrictModeReread = null
  for (const listener of listeners) listener(text)
  const published = text
  window.clearTimeout(expiry)
  expiry = window.setTimeout(() => {
    if (unreadDraft === published) unreadDraft = null
    if (draftForStrictModeReread === published) draftForStrictModeReread = null
  }, UNREAD_DRAFT_LIFETIME_MS)
}

export function takeCoachDraft() {
  if (unreadDraft != null) {
    draftForStrictModeReread = unreadDraft
    unreadDraft = null
    queueMicrotask(() => {
      draftForStrictModeReread = null
    })
    return draftForStrictModeReread
  }
  return draftForStrictModeReread
}

export function subscribeCoachDraft(listener: (text: string) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
