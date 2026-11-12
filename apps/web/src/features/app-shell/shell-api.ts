export type ShellJob = {
  id: string
  title: string
  company: string
  starred: boolean
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function parseJobs(data: unknown): ShellJob[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    const row = record(item)
    if (row?.starred !== true) return []
    const title = text(row.title)
    if (!title) return []
    return [
      {
        id: text(row.id),
        title,
        company: text(row.company),
        starred: true,
      },
    ]
  })
}

export const starredJobs = parseJobs
