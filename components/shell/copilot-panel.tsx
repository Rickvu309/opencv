"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Mail, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Chip } from "@/components/shared/chip";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { AiThinking } from "@/components/shared/ai-thinking";
import { EmptyState } from "@/components/shared/empty-state";
import { copilotScripts } from "@/lib/data/copilot-scripts";
import { buildCopilotCaptureCandidate } from "@/lib/data/track-record";
import { emailEvidence } from "@/lib/data/sources";
import { getCopilotContextChip } from "@/lib/copilot-utils";
import { freshnessLabel } from "@/lib/inbox-utils";
import { today, useStore } from "@/lib/store";
import type { CopilotHandoff, CopilotMessage, CopilotSuggestedAction } from "@/lib/types";

/**
 * Whether the panel's current surface has connected-source evidence behind
 * it: an opportunity with mapped email evidence, or a surface (Home, Track
 * Record) that aggregates evidence across opportunities.
 */
function surfaceHasEvidence(surface: string, objectLabel: string | undefined, opportunities: { id: string; role: string; company: string }[]): boolean {
  const relatedOpportunity = opportunities.find((item) => `${item.role} at ${item.company}` === objectLabel);
  if (relatedOpportunity) {
    return emailEvidence.some(
      (evidence) => evidence.mapsToType === "opportunity" && evidence.mapsToId === relatedOpportunity.id
    );
  }
  const base = surface.split(":")[0].trim();
  return base === "Home" || base === "Track Record";
}

export function CopilotPanel() {
  const { state, sendCopilotMessage, setCopilotOpen } = useStore();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const surface = state.copilot.surface;
  const script = copilotScripts.find((entry) => entry.surface === surface);
  const messages = state.copilot.messagesBySurface[surface] ?? [];
  const emailSource = state.connectedSources.find(
    (source) => source.type === "email" && source.status === "connected"
  );
  const showSourceLine =
    emailSource && surfaceHasEvidence(surface, state.copilot.objectLabel, state.opportunities);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, state.copilot.thinking]);

  function handleSend(text: string) {
    if (!text.trim()) return;
    sendCopilotMessage(text);
    setDraft("");
  }

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CopilotTag />
          <Chip label={getCopilotContextChip(surface, state.copilot.objectLabel)} className="max-w-full bg-muted text-foreground" />
          {showSourceLine && emailSource ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="size-3" />
              Reading: Email, synced {freshnessLabel(emailSource.lastSyncedMinutesAgo ?? 0)}
            </span>
          ) : null}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close Copilot" onClick={() => setCopilotOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 px-4 py-3">
          {messages.length === 0 ? (
            <EmptyState message="Ask Copilot about this page, or try a suggested prompt below." />
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
          {state.copilot.thinking ? <AiThinking /> : null}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {script && script.suggestedPrompts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
          {script.suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-center gap-2 border-t border-border px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Copilot..."
          aria-label="Message Copilot"
        />
        <Button type="submit" size="icon-sm" aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </form>
    </aside>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {message.text}
        </p>
      </div>
    );
  }

  const response = message.response;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <CopilotTag />
      <div className="flex max-w-[92%] flex-col gap-2 rounded-lg bg-muted px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-foreground">{response?.lead ?? message.text}</p>
          {response?.confidence ? <ConfidenceChip confidence={response.confidence} className="shrink-0" /> : null}
        </div>

        {response?.points && response.points.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {response.points.map((point) => (
              <li key={point.label} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{point.label}: </span>
                {point.detail}
              </li>
            ))}
          </ul>
        ) : null}

        {response?.action ? <ActionRow action={response.action} /> : null}
        {response?.handoff ? <HandoffRow handoff={response.handoff} /> : null}
      </div>
    </div>
  );
}

function ActionRow({ action }: { action: CopilotSuggestedAction }) {
  const { state, acceptNextAction, acceptLearningItem, addTrackRecordEntry } = useStore();

  if (action.kind === "accept-next-action") {
    const target = state.nextActions.find((item) => item.id === action.targetId);
    const actionable = target?.state === "suggested";
    return (
      <div className="pt-0.5">
        <Button size="sm" variant="outline" disabled={!actionable} onClick={() => target && acceptNextAction(target.id)}>
          <Check className="size-3.5" />
          {actionable ? action.label : "Already in your plan"}
        </Button>
      </div>
    );
  }

  if (action.kind === "add-learning-item") {
    const target = state.learningItems.find((item) => item.id === action.targetId);
    const actionable = target?.state === "suggested";
    return (
      <div className="pt-0.5">
        <Button size="sm" variant="outline" disabled={!actionable} onClick={() => target && acceptLearningItem(target.id)}>
          <Check className="size-3.5" />
          {actionable ? action.label : "Already in your plan"}
        </Button>
      </div>
    );
  }

  const alreadyAdded = state.trackRecordEntries.some((entry) => entry.id === action.entryId);
  return (
    <div className="pt-0.5">
      <Button
        size="sm"
        variant="outline"
        disabled={alreadyAdded}
        onClick={() => {
          if (alreadyAdded) return;
          addTrackRecordEntry(buildCopilotCaptureCandidate(today()));
        }}
      >
        <Check className="size-3.5" />
        {alreadyAdded ? "Added to Track Record" : action.label}
      </Button>
    </div>
  );
}

function HandoffRow({ handoff }: { handoff: CopilotHandoff }) {
  const { state } = useStore();

  let href = "/opportunities";
  if (handoff.kind === "route") {
    href = handoff.href;
  } else {
    const opportunity = state.opportunities.find(
      (item) => `${item.role} at ${item.company}` === state.copilot.objectLabel
    );
    href = opportunity ? `/opportunities/${opportunity.id}#${handoff.tab}` : "/opportunities";
  }

  return (
    <div className="pt-0.5">
      <Button asChild size="sm" variant="outline">
        <Link href={href}>
          {handoff.label}
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
