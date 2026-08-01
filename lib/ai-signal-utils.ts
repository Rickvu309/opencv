import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, Flame, Mail, PenLine } from "lucide-react";

import { emailEvidence } from "@/lib/data/sources";
import type { AiSignal, AiSignalIconKind, EmailEvidence } from "@/lib/types";

// Shared read-only helpers for the AI signal pattern (components/ai/): the
// evidence lookup and the "what exactly changed" message, reused by the
// save-back confirmation banner and the Activity log entry so both always
// say the same thing.

/** Beat 1's kind icon, one source of truth so SignalCard and Home's decision queue never drift on which icon means what. */
export const AI_SIGNAL_ICON: Record<AiSignalIconKind, LucideIcon> = {
  email: Mail,
  status: ArrowRightLeft,
  urgency: Flame,
  draft: PenLine,
};

export function findSignalEvidence(signal: AiSignal): EmailEvidence | undefined {
  return emailEvidence.find((entry) => entry.id === signal.evidenceId);
}

/** Names exactly what changed, read from the signal's own current fields so an edited value before approval is reflected correctly. */
export function buildSignalConfirmationMessage(signal: AiSignal): string {
  switch (signal.kind) {
    case "next-action":
      return `Next action updated to: ${signal.newVerb}.`;
    case "status-change":
      return `Status moved to ${signal.newStatus}.`;
    case "priority-bump":
      return `Priority raised to ${signal.newPriority} and added: ${signal.addedNextAction.verb}.`;
    case "draft-reply":
      return `Reply sent and marked done: "${signal.draftText}"`;
    default:
      return "Updated.";
  }
}

/** Same confirmation text, with the grounding source named, for the Activity log entry. */
export function buildSignalActivityMessage(signal: AiSignal): string {
  const evidence = findSignalEvidence(signal);
  const base = buildSignalConfirmationMessage(signal);
  return evidence ? `${base} Based on ${evidence.sender}'s email, "${evidence.subject}".` : base;
}
