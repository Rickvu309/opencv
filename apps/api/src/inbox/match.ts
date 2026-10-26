export type InboxMatchJob = {
  id: string
  title: string
  company: string
}

export type InboxMatchThread = {
  company: string
  role: string
  summary: string
  suggestedStage: "interview" | null
}

export function normalizeInboxText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function longWords(value: string) {
  return normalizeInboxText(value)
    .split(" ")
    .filter((word) => word.length > 3)
}

/** Company match, then a shared word longer than three letters, or the only job at that company. */
export function matchInboxJob(
  thread: InboxMatchThread,
  jobs: readonly InboxMatchJob[]
): { jobId: string | null; suggestedStage: "interview" | null } {
  const company = normalizeInboxText(thread.company)
  const same = jobs.filter((job) => normalizeInboxText(job.company) === company)
  const roleWords = new Set(longWords(thread.role))
  const shared = same.filter((job) =>
    longWords(job.title).some((word) => roleWords.has(word))
  )
  const matched = shared[0] ?? (same.length === 1 ? same[0] : undefined)
  const rejection = /not moving forward/i.test(thread.summary)
  const interview =
    thread.suggestedStage === "interview" || /interview/i.test(thread.summary)
  return {
    jobId: matched?.id ?? null,
    suggestedStage: matched && !rejection && interview ? "interview" : null,
  }
}
