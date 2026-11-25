import type { QueryOutput } from "@workspace/domain"

import { apiFetch } from "./api.ts"
import { unwrapData, type SuccessBody } from "./api-envelope.ts"
import {
  qualifiedPaperRead,
  type PaperQualification,
} from "./paper-qualification.ts"
import { endpoints } from "./requests.ts"

export function qualifiedCoachPaperOptions(options: PaperQualification) {
  return qualifiedPaperRead("paper.list", endpoints.paper, options)
}

export function coachPaperOptions() {
  return apiFetch<SuccessBody<QueryOutput<"paper.list">>>(endpoints.paper).then(
    unwrapData
  )
}
