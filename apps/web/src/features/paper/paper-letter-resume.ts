import { z } from "@workspace/domain/kernel"

const stoppedLetterSchema = z.object({
  docId: z.string(),
  chatId: z.string(),
  prompt: z.string(),
  jobId: z.string().nullable(),
})
export type StoppedLetter = z.infer<typeof stoppedLetterSchema>

const KEY = "opencv-stopped-letter"
type Listener = () => void
let cached: string | null = null
let record: StoppedLetter | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function rememberStoppedLetter(next: StoppedLetter) {
  cached = JSON.stringify(next)
  record = next
  sessionStorage.setItem(KEY, cached)
  emit()
}

export function stoppedLetter() {
  const raw = sessionStorage.getItem(KEY)
  if (raw === cached) return record
  cached = raw
  try {
    const parsed = stoppedLetterSchema.safeParse(raw ? JSON.parse(raw) : null)
    record = parsed.success ? parsed.data : null
  } catch {
    record = null
  }
  return record
}

export function subscribeStoppedLetter(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearStoppedLetter(docId?: string) {
  const live = stoppedLetter()
  if (!live || (docId && live.docId !== docId)) return
  record = null
  cached = null
  sessionStorage.removeItem(KEY)
  emit()
}
