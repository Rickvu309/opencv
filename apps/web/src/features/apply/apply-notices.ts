import { isDemoApplyCard } from "@workspace/domain"
import type { Notice } from "@workspace/ui/components/notification-stack"

import {
  APPLY_DEMO_CLEAR_LABEL,
  APPLY_DEMO_TEXT,
  APPLY_DEMO_TITLE,
} from "@/features/apply/apply-job-structure.ts"
import type { ApplyCard } from "@/features/apply/apply-types.ts"

export const APPLY_DEMO_NOTICE_ID = "demo"
const MAX_FOLLOW_UPS = 2

type Handlers = {
  onClearDemo: () => void
  onOpenCard: (id: string) => void
}

/**
 * The demo notice while starter cards remain, then reminders for your own
 * Follow-up Tracks that are due. Dismissed ids stay out for the session.
 */
export function applyNotices(
  cards: readonly ApplyCard[],
  today: string,
  dismissed: ReadonlySet<string>,
  { onClearDemo, onOpenCard }: Handlers
): Notice[] {
  const notices: Notice[] = []
  if (cards.some(isDemoApplyCard)) {
    notices.push({
      id: APPLY_DEMO_NOTICE_ID,
      badge: APPLY_DEMO_TITLE,
      title: `${APPLY_DEMO_TITLE} Opportunities`,
      text: APPLY_DEMO_TEXT,
      action: { label: APPLY_DEMO_CLEAR_LABEL, onClick: onClearDemo },
      pattern: "grid",
    })
  }
  const due = cards
    .filter(
      (card) =>
        !isDemoApplyCard(card) &&
        card.trackKind === "followup" &&
        card.stage !== "closed" &&
        card.trackDate <= today
    )
    .sort((a, b) => a.trackDate.localeCompare(b.trackDate))
    .slice(0, MAX_FOLLOW_UPS)
  for (const card of due) {
    notices.push({
      id: `followup-${card.id}`,
      badge: "Follow-up",
      title: `Follow up with ${card.company}`,
      text: `${card.title} is due for a follow-up.`,
      action: { label: "Open Opportunity", onClick: () => onOpenCard(card.id) },
      pattern: "rays",
    })
  }
  return notices.filter((notice) => !dismissed.has(notice.id))
}
