import type { JobStage } from "@workspace/domain"

import { stageLabel } from "./apply-stages.ts"

export function railStageLabel(stage: JobStage) {
  return stage === "closed" ? "Closed, not selected" : stageLabel(stage)
}
