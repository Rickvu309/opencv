import { recruiterCandidateForkedSurface } from "@/lib/copilot-surface-names";
import { findRecruiterRole } from "@/lib/recruiter-utils";
import { recruiterCandidates } from "@/lib/data/recruiter/candidates";
import { recruiterRoles } from "@/lib/data/recruiter/roles";
import type { CopilotSurfaceScript, RecruiterCandidate } from "@/lib/types";

// Recruiter mode's own Copilot scripts (RDS-988), merged into the shared
// copilotScripts registry (lib/data/copilot-scripts.ts) so the one
// CopilotPanel component keeps working unmodified on /recruiter/* the same
// way it already does everywhere else. One pipeline-wide surface (who needs
// attention today, this role's bottleneck) plus one per-candidate forked
// surface for every seeded candidate, so "summarize for the hiring manager"
// always names the real candidate currently open, never a generic answer.

const pipelineScript: CopilotSurfaceScript = {
  surface: "Recruiter Pipeline",
  suggestedPrompts: [
    "Who needs attention today?",
    "Where's the Senior Product Designer role stuck?",
    "Who's on hold right now?",
    "Who's ready to submit to the hiring manager?",
  ],
  exchanges: [
    {
      id: "copilot-recruiter-pipeline-1",
      prompt: "Who needs attention today?",
      response: {
        lead: "Three candidates need a decision or a nudge today.",
        points: [
          {
            label: "Elena Kowalski",
            detail: "9 days in Screening with no technical screen booked, the referral is starting to go cold.",
          },
          {
            label: "Ngoc Anh Vu",
            detail: "Blocked in Interview, still waiting on her updated case-study deck before the panel can be scheduled.",
          },
          { label: "Marcus Johnson", detail: "Offer decision overdue before Friday's deadline." },
        ],
        confidence: "High",
        handoff: { kind: "route", href: "/recruiter", label: "Open the pipeline" },
      },
    },
    {
      id: "copilot-recruiter-pipeline-2",
      prompt: "Where's the Senior Product Designer role stuck?",
      response: {
        lead: "In Screening and Interview, not at the top of the funnel.",
        points: [
          { label: "Screening", detail: "Elena Kowalski's technical screen still isn't booked, 9 days in." },
          {
            label: "Interview",
            detail:
              "Ngoc Anh Vu's panel is waiting on an updated case study, and Bao Le's split panel feedback needs a tie-breaking conversation.",
          },
        ],
        handoff: { kind: "route", href: "/recruiter/roles", label: "Open Roles" },
      },
    },
    {
      id: "copilot-recruiter-pipeline-3",
      prompt: "Who's on hold right now?",
      response: {
        lead: "One candidate is on hold today.",
        points: [
          {
            label: "Ngoc Anh Vu",
            detail: "Waiting on her updated case-study deck before the panel can be scheduled.",
          },
        ],
        handoff: { kind: "route", href: "/recruiter/candidates/rc-5", label: "Open Ngoc Anh Vu" },
      },
    },
    {
      id: "copilot-recruiter-pipeline-4",
      prompt: "Who's ready to submit to the hiring manager?",
      response: {
        lead: "Hoang Minh Chau is ready to package up for Trong Le.",
        points: [
          {
            label: "Hoang Minh Chau",
            detail: "Review complete, outreach current, notes on file, no open questions left.",
          },
        ],
        handoff: { kind: "route", href: "/recruiter/candidates/rc-10", label: "Open Hoang Minh Chau" },
      },
    },
  ],
};

function buildCandidateSummaryScript(candidate: RecruiterCandidate, roleTitle: string): CopilotSurfaceScript {
  return {
    surface: recruiterCandidateForkedSurface(candidate.name),
    suggestedPrompts: ["Summarize for the hiring manager"],
    exchanges: [
      {
        id: `copilot-recruiter-candidate-${candidate.id}`,
        prompt: "Summarize for the hiring manager",
        response: {
          lead: `${candidate.name}, ${candidate.currentTitle} at ${candidate.currentCompany}, for ${roleTitle}.`,
          points: [
            { label: "Strengths", detail: candidate.aiStrengths },
            { label: "Watchouts", detail: candidate.aiWatchouts },
            { label: "Suggested next step", detail: candidate.suggestedNextStep },
          ],
          handoff: { kind: "route", href: `/recruiter/candidates/${candidate.id}`, label: `Open ${candidate.name}` },
        },
      },
    ],
  };
}

export const recruiterCopilotScripts: CopilotSurfaceScript[] = [
  pipelineScript,
  ...recruiterCandidates.map((candidate) =>
    buildCandidateSummaryScript(candidate, findRecruiterRole(candidate.roleId, recruiterRoles)?.title ?? "the open role")
  ),
];
