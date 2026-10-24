import type { Recommendation } from "@workspace/ui/components/smart-recommendation"

import type {
  ApplyCard,
  StageId,
  TrackKind,
} from "@/features/apply/apply-types.ts"

export type NextStep = Recommendation & {
  stage?: StageId
  trackKind?: TrackKind
}

/** The first step is the recommendation, the rest are alternatives. */
export function nextSteps(
  card: Pick<ApplyCard, "stage" | "company">
): NextStep[] {
  const followUp = (signal: 0 | 1 | 2 | 3): NextStep => ({
    id: "followup",
    label: "Set a follow-up",
    reason: `Mark ${card.company} as a Follow-up and pick the date below.`,
    signal,
    trackKind: "followup",
  })
  switch (card.stage) {
    case "inbox":
      return [
        {
          id: "to-prep",
          label: "Move to Prep",
          reason: `Tailor your CV for ${card.company} before you apply.`,
          signal: 3,
          stage: "prep",
        },
        followUp(1),
      ]
    case "prep":
      return [
        {
          id: "to-sent",
          label: "Move to Sent",
          reason: `Once your application to ${card.company} is in, track it in Sent.`,
          signal: 2,
          stage: "sent",
        },
        followUp(1),
      ]
    case "sent":
      return [
        followUp(3),
        {
          id: "to-live",
          label: "Move to Live",
          reason: `They replied and the process with ${card.company} is on.`,
          signal: 1,
          stage: "live",
        },
      ]
    case "live":
      return [
        {
          id: "interview",
          label: "Plan the interview",
          reason: `Put the ${card.company} interview on your calendar.`,
          signal: 3,
          trackKind: "interview",
        },
        {
          id: "to-closed",
          label: "Move to Closed",
          reason: "The process is over, whatever the answer.",
          signal: 0,
          stage: "closed",
        },
      ]
    default:
      return []
  }
}
