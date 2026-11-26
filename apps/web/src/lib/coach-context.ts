import {
  qualifiedPaperRead,
  type PaperQualification,
} from "./paper-qualification.ts"
import { endpoints } from "./requests.ts"

export function qualifiedCoachPaperOptions(options: PaperQualification) {
  return qualifiedPaperRead("paper.list", endpoints.paper, options)
}
