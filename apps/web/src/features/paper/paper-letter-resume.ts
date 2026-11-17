export type StoppedLetter = {
  docId: string
  prompt: string
  jobId: string | null
}

type Listener = () => void

let record: StoppedLetter | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function rememberStoppedLetter(next: StoppedLetter) {
  record = next
  emit()
}

export function stoppedLetter() {
  return record
}

export function subscribeStoppedLetter(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearStoppedLetter(docId?: string) {
  if (!record) return
  if (docId && record.docId !== docId) return
  record = null
  emit()
}
