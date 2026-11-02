// The Apply board lanes as the app renders them, held to the stage list in the domain (JOB_STAGES minus the hidden one).
import { HIDDEN_STAGE, SOURCE_FILES, boardStages } from "./assumes.mjs"

export function boardLanes(snap, stages = boardStages()) {
  const lanes = snap.lanes ?? []
  return {
    stages,
    lanes,
    // The heading names its stage: the lane with data-stage="applied" is headed "Applied".
    misnamed: lanes.filter(
      (l) =>
        l.heading &&
        l.stage !== HIDDEN_STAGE &&
        l.heading.toLowerCase() !== l.stage?.replace(/-/g, " ")
    ),
    missing: (stages ?? []).filter(
      (s) => !lanes.some((l) => l.stage === s && l.heading)
    ),
    hiddenShown: lanes.some((l) => l.stage === HIDDEN_STAGE),
    unread: stages
      ? null
      : `stage list (JOB_STAGES not readable in ${SOURCE_FILES.jobStages})`,
  }
}

export const badFixture = [
  {
    name: "a stage with no lane",
    fails: () =>
      boardLanes({ lanes: [{ stage: "saved", heading: "Saved" }] }, [
        "saved",
        "applied",
      ]).missing.length > 0,
  },
  {
    name: "a lane headed with another stage's name",
    fails: () =>
      boardLanes({ lanes: [{ stage: "applied", heading: "Offer" }] }, [
        "applied",
      ]).misnamed.length > 0,
  },
]
