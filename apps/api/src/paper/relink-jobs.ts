import {
  catalog,
  ERROR_CODES,
  type Actor,
  type PaperView,
} from "@workspace/domain"

import { CommandError } from "../platform/errors.js"
import type { Registry } from "../registry/registry.js"

type LinkedJob = { linked?: Record<string, { id: string } | null> }

function missingJob(error: unknown) {
  return error instanceof CommandError && error.code === ERROR_CODES.NOT_FOUND
}

export async function relinkJobs(
  registry: Registry,
  actor: Actor,
  restored: { page: PaperView; linkedJobs: readonly string[] }
) {
  for (const jobId of restored.linkedJobs) {
    let job: LinkedJob
    try {
      job = (await registry.read("job.get", { jobId }, actor)) as LinkedJob
    } catch (error) {
      if (missingJob(error)) continue
      throw error
    }
    if (job.linked?.[restored.page.kind]) continue
    await registry.execute({
      name: catalog["job.linkPaper"].name,
      input: { jobId, docId: restored.page.id, kind: restored.page.kind },
      actor,
    })
  }
}
