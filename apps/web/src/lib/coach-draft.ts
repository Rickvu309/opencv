/**
 * A block editor asks the dock to open with this text. The shell reads it
 * once. A second read in the same turn still sees it, because Strict Mode
 * renders twice before the draft is applied.
 */
let pending: string | null = null
let burst: string | null = null
let expiry: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<(text: string) => void>()

export function publishCoachDraft(text: string) {
  pending = text
  burst = null
  for (const listener of listeners) listener(text)
  const published = text
  window.clearTimeout(expiry)
  expiry = window.setTimeout(() => {
    if (pending === published) pending = null
    if (burst === published) burst = null
  }, 500)
}

export function takeCoachDraft() {
  if (pending != null) {
    burst = pending
    pending = null
    queueMicrotask(() => {
      burst = null
    })
    return burst
  }
  return burst
}

export function subscribeCoachDraft(listener: (text: string) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
