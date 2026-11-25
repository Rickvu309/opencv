import { catalog } from "@workspace/domain"

const JOB_FIELDS = [
  "title",
  "company",
  "stage",
  "position",
  "location",
  "priority",
  "starred",
  "jobUrl",
  "description",
  "deadline",
  "interviewAt",
  "cvDocId",
  "letterDocId",
  "updatedAt",
] as const

export function jobUnchangedSince(
  jobId: string,
  job: Record<string, unknown>,
  skipped: string
) {
  return {
    query: catalog["job.get"].name,
    input: { jobId },
    matches: Object.fromEntries(JOB_FIELDS.map((field) => [field, job[field]])),
    skipped,
  }
}

export function checklistItemUnchangedSince(
  jobId: string,
  item: { id: string; label?: string; done: boolean },
  skipped: string
) {
  return {
    query: catalog["job.checklistItem"].name,
    input: { jobId, itemId: item.id },
    matches: {
      done: item.done,
      ...(item.label === undefined ? {} : { label: item.label }),
    },
    skipped,
  }
}
