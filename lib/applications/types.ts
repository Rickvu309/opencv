/**
 * One application, from interested to whatever happens.
 *
 * The unit the product is ultimately for. A CV nobody sends and a fit score
 * nobody acts on are both preparation; this is the row that says a real thing
 * was sent to a real company on a real day.
 */

import type { Msg } from "@/lib/i18n/locale";

/**
 * Where an application stands.
 *
 * Four forward stages and one ending. `rejected` is deliberately not a fifth
 * stage on the same line: it can arrive from anywhere and it stops the
 * progression, which is a different shape from the others.
 */
export type ApplicationStatus =
  | "interested"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected";

/** The forward order. Index in this array is how far along an application is. */
export const FORWARD_STATUSES: ApplicationStatus[] = [
  "interested",
  "applied",
  "interviewing",
  "offer",
];

export type Application = {
  id: string;
  /** The saved `Opening` this is an application to. */
  openingId: string;
  status: ApplicationStatus;
  /** Tailored copies bound to this application, never the originals. */
  tailoredDocumentIds: string[];
  notes: string;
  /** ISO date, `YYYY-MM-DD`. A date rather than a timestamp: a deadline is a day. */
  deadline?: string;
  createdAt: number;
  updatedAt: number;
};

/**
 * Is this status change allowed?
 *
 * AC-APP-002: forward one stage at a time along the line, backward to any
 * earlier stage, and `rejected` from anywhere. Backward is allowed freely
 * because the reason for it is always a correction, and a tracker that will not
 * let you fix a misclick is a tracker people stop updating.
 *
 * Coming back from `rejected` is allowed too, and it is not a loophole: a
 * company that said no and then wrote again a month later is a real thing that
 * happens, and the alternative is the user making a second row for the same job.
 */
export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  if (from === to) return false;
  if (to === "rejected") return true;
  if (from === "rejected") return true;

  const at = FORWARD_STATUSES.indexOf(from);
  const next = FORWARD_STATUSES.indexOf(to);
  if (at < 0 || next < 0) return false;
  // Forward exactly one stage, or backward any distance.
  return next === at + 1 || next < at;
}

/**
 * What to do next, given where this stands.
 *
 * REQ-APP-007. Written here rather than asked of a model, because the answer is
 * the same for everybody at a given stage and a model call to produce it would
 * be slower, costlier, and occasionally wrong. The Coach's version, which the
 * tracker also offers, is the one that knows the person and the posting.
 */
export function nextStep(status: ApplicationStatus): Msg {
  switch (status) {
    case "interested":
      return "Read the requirements, tailor your CV to them, then send it." ;
    case "applied":
      return "Give it a week. No reply, send one short follow-up." ;
    case "interviewing":
      return "Prepare two real examples from your profile, and one question for them." ;
    case "offer":
      return "Ask about pay, the probation period, and who you'd work with." ;
    case "rejected":
      return "Write down one thing you learned, then find the next one." ;
  }
}

/** Applications in the order a person works them: soonest deadline first. */
export function byUrgency(applications: readonly Application[]): Application[] {
  return [...applications].sort((a, b) => {
    // A closed application drops below the live ones whatever its deadline.
    const closed = (app: Application) => (app.status === "rejected" ? 1 : 0);
    if (closed(a) !== closed(b)) return closed(a) - closed(b);
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.updatedAt - a.updatedAt;
  });
}
