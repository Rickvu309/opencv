"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, Flame, Mail, PenLine } from "lucide-react";

import { AiActionCard } from "@/components/ai/ai-action-card";
import { buildSignalConfirmationMessage, findSignalEvidence } from "@/lib/ai-signal-utils";
import { useStore } from "@/lib/store";
import type { AiSignal, AiSignalIconKind } from "@/lib/types";

const SIGNAL_ICON: Record<AiSignalIconKind, LucideIcon> = {
  email: Mail,
  status: ArrowRightLeft,
  urgency: Flame,
  draft: PenLine,
};

interface SignalCardProps {
  signal: AiSignal;
  context?: ReactNode;
  className?: string;
}

/**
 * The connected wrapper around AiActionCard for one AiSignal: wires
 * Approve, Edit, Dismiss, and Undo straight to the store so the opportunity
 * Signals area and the Home attention queue can drop in the same instance
 * without re-wiring the store calls twice.
 */
export function SignalCard({ signal, context, className }: SignalCardProps) {
  const { approveAiSignal, dismissAiSignal, undoAiSignal } = useStore();
  const [draft, setDraft] = useState<string | undefined>(undefined);

  const evidence = findSignalEvidence(signal);
  if (!evidence) return null;

  const editable =
    signal.kind === "next-action"
      ? { label: "Next action", value: draft ?? signal.newVerb, onChange: setDraft }
      : signal.kind === "draft-reply"
        ? { label: "Reply draft", value: draft ?? signal.draftText, onChange: setDraft }
        : undefined;

  return (
    <AiActionCard
      icon={SIGNAL_ICON[signal.iconKind]}
      context={context}
      signal={signal.signal}
      whyItMatters={signal.whyItMatters}
      evidence={evidence}
      proposedAction={signal.proposedAction}
      editable={editable}
      approved={signal.state === "approved"}
      confirmationMessage={buildSignalConfirmationMessage(signal)}
      onApprove={() => approveAiSignal(signal.id, draft)}
      onDismiss={() => dismissAiSignal(signal.id)}
      onUndo={() => undoAiSignal(signal.id)}
      className={className}
    />
  );
}
