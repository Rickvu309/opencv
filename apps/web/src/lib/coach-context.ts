import { listPaper } from "./paper-reader.ts"
import type { QueryOutput } from "@workspace/domain"

import { apiFetch } from "./api.ts"
import { unwrapData, type SuccessBody } from "./api-envelope.ts"
import { endpoints } from "./requests.ts"

export function coachPaperOptions() {
  return listPaper()
}

export function coachJobOptions() {
  return apiFetch<SuccessBody<QueryOutput<"job.list">>>(endpoints.jobs).then(
    unwrapData
  )
}
