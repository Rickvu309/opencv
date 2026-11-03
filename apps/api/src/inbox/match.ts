export type InboxMatchJob = {
  id: string
  title: string
  company: string
  updatedAt?: Date | string | null
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

function sharedWordCount(title: string, roleWords: ReadonlySet<string>) {
  let count = 0
  for (const word of new Set(longWords(title))) {
    if (roleWords.has(word)) count += 1
  }
  return count
}

function updatedMs(job: InboxMatchJob) {
  if (job.updatedAt == null) return Number.NEGATIVE_INFINITY
  const ms =
    job.updatedAt instanceof Date
      ? job.updatedAt.getTime()
      : new Date(job.updatedAt).getTime()
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms
}

export function matchInboxJob(
  thread: InboxMatchThread,
  jobs: readonly InboxMatchJob[]
): { jobId: string | null; suggestedStage: "interview" | null } {
  const company = normalizeInboxText(thread.company)
  const same = jobs.filter((job) => normalizeInboxText(job.company) === company)
  const roleWords = new Set(longWords(thread.role))
  const shared = same.filter((job) => sharedWordCount(job.title, roleWords) > 0)
  const matched =
    pickSharedJob(shared, roleWords) ??
    (same.length === 1 ? same[0] : undefined)
  const rejection = /not moving forward/i.test(thread.summary)
  const interview =
    thread.suggestedStage === "interview" || /interview/i.test(thread.summary)
  return {
    jobId: matched?.id ?? null,
    suggestedStage: matched && !rejection && interview ? "interview" : null,
  }
}

function pickSharedJob(
  shared: readonly InboxMatchJob[],
  roleWords: ReadonlySet<string>
) {
  if (shared.length === 0) return undefined
  const scored = shared.map((job) => ({
    job,
    words: sharedWordCount(job.title, roleWords),
    updated: updatedMs(job),
  }))
  const bestWords = Math.max(...scored.map((row) => row.words))
  const byWords = scored.filter((row) => row.words === bestWords)
  const bestUpdated = Math.max(...byWords.map((row) => row.updated))
  const tied = byWords.filter((row) => row.updated === bestUpdated)
  return tied.length === 1 ? tied[0]?.job : undefined
}
