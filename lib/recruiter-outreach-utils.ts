import type { RecruiterCandidate, RecruiterOutreachDraft, RecruiterRole } from "@/lib/types";

// RDS-989: Outreach draft helpers. Every fully-seeded candidate's drafts
// live in lib/data/recruiter/candidates.ts; every other candidate falls
// back to buildFallbackOutreachDrafts here, computed live off the same
// RecruiterOutreachDraft shape so the UI (components/recruiter/outreach-
// draft-card.tsx) never branches on which source a draft came from.

function firstName(name: string): string {
  return name.split(" ")[0];
}

/**
 * A believable, stage-appropriate draft or two for a candidate with no
 * seeded drafts: a screening invite for a fresh Sourced candidate, an
 * interview-scheduling nudge once through Screening, an internal note to
 * the hiring manager once in Interview or Offer, plus a standing
 * respectful-close option, always available, the same "the templates fall
 * back sensibly for the rest" the brief asks for. Ids are deterministic
 * (candidate id plus kind) so the session-only sent/discarded state in
 * StoreState.recruiterOutreachDraftStates stays stable across renders.
 */
export function buildFallbackOutreachDrafts(candidate: RecruiterCandidate, role: RecruiterRole | undefined): RecruiterOutreachDraft[] {
  const roleTitle = role?.title ?? "the open role";
  const drafts: RecruiterOutreachDraft[] = [];

  if (candidate.stage === "Sourced") {
    drafts.push({
      id: `${candidate.id}-fallback-screening-invite`,
      kind: "screening-invite",
      channel: "Email",
      purposeLine: `Invite ${candidate.name} to a first screen`,
      body: `Hi ${firstName(candidate.name)}, thanks for your interest in the ${roleTitle} role at Saola Labs. Would you be open to a 20-minute intro call this week?`,
    });
  } else if (candidate.stage === "Screening") {
    drafts.push({
      id: `${candidate.id}-fallback-interview-scheduling`,
      kind: "interview-scheduling",
      channel: "Email",
      purposeLine: `Move ${candidate.name} to the interview round`,
      body: `Hi ${firstName(candidate.name)}, great news, we'd like to move you to the next round. Sending a scheduling link shortly, let me know what times work best.`,
    });
  } else if (candidate.stage === "Interview" || candidate.stage === "Offer") {
    drafts.push({
      id: `${candidate.id}-fallback-hiring-manager-nudge`,
      kind: "hiring-manager-nudge",
      channel: "Internal note",
      purposeLine: `Nudge the hiring manager on ${candidate.name}`,
      body: `${candidate.submission.hiringManager.split(",")[0]}, checking in on ${candidate.name} for ${roleTitle}. ${candidate.suggestedNextStep}`,
    });
  }

  drafts.push({
    id: `${candidate.id}-fallback-respectful-close`,
    kind: "respectful-close",
    channel: "Email",
    purposeLine: `Close out ${candidate.name} respectfully`,
    body: `Hi ${firstName(candidate.name)}, thank you for the time you put into the ${roleTitle} process. We're not moving forward right now, but we'd love to stay in touch for future openings.`,
  });

  return drafts;
}

/** Seeded drafts if the candidate has any, otherwise the fallback set. */
export function getRecruiterOutreachDrafts(candidate: RecruiterCandidate, role: RecruiterRole | undefined): RecruiterOutreachDraft[] {
  if (candidate.outreach.drafts && candidate.outreach.drafts.length > 0) return candidate.outreach.drafts;
  return buildFallbackOutreachDrafts(candidate, role);
}

/** "Reads in about N seconds," computed live off the body's word count at a 200wpm reading speed, never a fabricated number. */
export function outreachReadTimeSeconds(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.round((words / 200) * 60));
}
