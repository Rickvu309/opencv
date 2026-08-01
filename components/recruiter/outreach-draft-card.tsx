"use client";

import { useState } from "react";
import { Check, Mail, MessageCircle, Pencil, Phone, Send, StickyNote, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { outreachReadTimeSeconds } from "@/lib/recruiter-outreach-utils";
import { useStore } from "@/lib/store";
import type { RecruiterCandidate, RecruiterOutreachChannel, RecruiterOutreachDraft } from "@/lib/types";

const CHANNEL_ICON: Record<RecruiterOutreachChannel, typeof Mail> = {
  Email: Mail,
  LinkedIn: MessageCircle,
  Phone: Phone,
  "Internal note": StickyNote,
};

/**
 * One outreach draft: purpose line, the editable body, a "reads in about N
 * seconds" hint, and Edit / Mark as sent / Discard, the anatomy the brief
 * asks for. Mirrors AiActionCard's proposed-then-settled shape without
 * reusing it directly: a draft has no external evidence to cite, the draft
 * itself is the artifact.
 */
export function OutreachDraftCard({ candidate, draft }: { candidate: RecruiterCandidate; draft: RecruiterOutreachDraft }) {
  const { state, sendRecruiterOutreachDraft, discardRecruiterOutreachDraft, undiscardRecruiterOutreachDraft } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [body, setBody] = useState(draft.body);

  const draftState = state.recruiterOutreachDraftStates[draft.id] ?? "proposed";
  const Icon = CHANNEL_ICON[draft.channel];

  if (draftState === "sent") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <Check className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sent: {draft.purposeLine}</p>
      </div>
    );
  }

  if (draftState === "discarded") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
        <p className="text-sm text-muted-foreground">Discarded: {draft.purposeLine}</p>
        <Button size="sm" variant="ghost" onClick={() => undiscardRecruiterOutreachDraft(draft.id)}>
          Restore
        </Button>
      </div>
    );
  }

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm font-medium text-foreground">{draft.purposeLine}</p>
          </div>
          <CopilotTag className="shrink-0" />
        </div>

        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 pl-8">
          {isEditing ? (
            <Textarea
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="text-sm"
              aria-label={`${draft.purposeLine} draft`}
            />
          ) : (
            <p className="whitespace-pre-line text-sm text-foreground">{body}</p>
          )}
        </div>
        <p className="pl-8 text-xs text-muted-foreground">
          {draft.channel} · Reads in about {outreachReadTimeSeconds(body)} seconds
        </p>

        <div className="flex items-center gap-1.5 pl-8">
          <Button size="sm" onClick={() => sendRecruiterOutreachDraft(candidate, { ...draft, body })}>
            <Send className="size-3.5" />
            Mark as sent
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsEditing((current) => !current)}>
            <Pencil className="size-3.5" />
            {isEditing ? "Done editing" : "Edit"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => discardRecruiterOutreachDraft(draft.id)}>
            <X className="size-3.5" />
            Discard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
