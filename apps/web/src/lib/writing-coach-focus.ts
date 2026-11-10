type Listener = () => void

let docId: string | null = null
let holders = 0
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function writingCoachFocus() {
  return docId
}

export function subscribeWritingCoachFocus(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function holdWritingCoachFocus(next: string) {
  holders += 1
  if (docId !== next) {
    docId = next
    emit()
  }
  return () => {
    holders -= 1
    if (holders > 0) return
    queueMicrotask(() => {
      if (holders === 0 && docId === next) {
        docId = null
        emit()
      }
    })
  }
}
