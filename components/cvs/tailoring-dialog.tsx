"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiThinking } from "@/components/shared/ai-thinking";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { makeId, today, useStore } from "@/lib/store";
import type {
  CvSection,
  CvVersion,
  Opportunity,
  TailoringInsight,
  TailoringSuggestion,
} from "@/lib/types";

const CHANGE_TYPE_LABEL: Record<TailoringSuggestion["changeType"], string> = {
  reorder: "Reorder emphasis",
  rewrite: "Rewrite",
  keyword: "Add keyword",
  cut: "Cut a line",
};

type Phase = "pick" | "thinking" | "review";

interface TailoringDialogProps {
  trigger: React.ReactNode;
  /** CV detail entry point: the CV is fixed, the user picks a target opportunity. */
  fixedCv?: CvVersion;
  /** Materials tab entry point: the opportunity is fixed, the user picks a CV version to tailor. */
  fixedOpportunity?: Opportunity;
  /** Preselects the CV version to tailor, for example the version already linked in Materials. */
  defaultCvId?: string;
}

/**
 * The one tailoring surface both entry points converge on: a simulated
 * Copilot pass over the target opportunity's tailoring script, followed by a
 * per-suggestion accept or skip review, then "Create tailored version".
 */
export function TailoringDialog({ trigger, fixedCv, fixedOpportunity, defaultCvId }: TailoringDialogProps) {
  const { state, acceptTailoringSuggestion, dismissTailoringSuggestion, createTailoredCvVersion } =
    useStore();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("pick");
  const [selectedCvId, setSelectedCvId] = useState(fixedCv?.id ?? defaultCvId ?? "");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(fixedOpportunity?.id ?? "");
  const thinkingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (thinkingTimeout.current) clearTimeout(thinkingTimeout.current);
    };
  }, []);

  function reset() {
    setPhase("pick");
    setSelectedCvId(fixedCv?.id ?? defaultCvId ?? "");
    setSelectedOpportunityId(fixedOpportunity?.id ?? "");
    if (thinkingTimeout.current) clearTimeout(thinkingTimeout.current);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  const sourceCv = fixedCv ?? state.cvVersions.find((cv) => cv.id === selectedCvId);
  const opportunity = fixedOpportunity ?? state.opportunities.find((item) => item.id === selectedOpportunityId);
  const canStart = Boolean(sourceCv && opportunity);

  function handleStart() {
    setPhase("thinking");
    thinkingTimeout.current = setTimeout(() => setPhase("review"), 700 + Math.random() * 500);
  }

  const insight = opportunity
    ? state.insights.find(
        (item): item is TailoringInsight => item.kind === "tailoring" && item.hostId === opportunity.id
      ) ?? null
    : null;

  const suggestions = insight?.suggestions ?? [];
  const acceptedCount = suggestions.filter((suggestion) => suggestion.state === "accepted").length;

  function handleCreate() {
    if (!sourceCv || !opportunity || !insight) return;
    const accepted = insight.suggestions.filter((suggestion) => suggestion.state === "accepted");
    if (accepted.length === 0) return;

    const existingNames = new Set(state.cvVersions.map((cv) => cv.name));
    const baseName = `${opportunity.company}, tailored`;
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name)) {
      name = `${baseName} v${suffix}`;
      suffix += 1;
    }

    const sections: CvSection[] = sourceCv.sections.map((section) => {
      const match = accepted.find((suggestion) => suggestion.section === section.title);
      return match ? { ...section, content: match.proposedText } : section;
    });
    for (const suggestion of accepted) {
      if (!sections.some((section) => section.title === suggestion.section)) {
        sections.push({ id: makeId("cv-section"), title: suggestion.section, content: suggestion.proposedText });
      }
    }

    const cv: CvVersion = {
      id: makeId("cv"),
      name,
      kind: "tailored",
      opportunityId: opportunity.id,
      lastEditedAt: today(),
      sections,
    };

    createTailoredCvVersion(cv, opportunity);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tailor for this role</DialogTitle>
          <DialogDescription>
            Copilot drafts section-by-section suggestions tied to the fit analysis for this opportunity.
            Accept the ones you want, then create the tailored version.
          </DialogDescription>
        </DialogHeader>

        {phase === "pick" ? (
          <div className="flex flex-col gap-3">
            {fixedCv ? (
              <p className="text-sm text-muted-foreground">
                Tailoring <span className="font-medium text-foreground">{fixedCv.name}</span> for:
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pick a CV version to tailor for{" "}
                <span className="font-medium text-foreground">
                  {fixedOpportunity?.role} at {fixedOpportunity?.company}
                </span>
                :
              </p>
            )}

            {fixedCv ? (
              <Select value={selectedOpportunityId} onValueChange={setSelectedOpportunityId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an opportunity" />
                </SelectTrigger>
                <SelectContent>
                  {state.opportunities.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.role} at {item.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedCvId} onValueChange={setSelectedCvId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a CV version" />
                </SelectTrigger>
                <SelectContent>
                  {state.cvVersions.map((cv) => (
                    <SelectItem key={cv.id} value={cv.id}>
                      {cv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : null}

        {phase === "thinking" ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <AiThinking label="Reading the fit analysis and drafting suggestions" />
          </div>
        ) : null}

        {phase === "review" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <CopilotTag />
                <span className="text-sm text-foreground">
                  {sourceCv?.name} for {opportunity?.role} at {opportunity?.company}
                </span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {acceptedCount} of {suggestions.length} accepted
              </span>
            </div>

            {suggestions.length === 0 ? (
              <EmptyState message="Copilot hasn't drafted tailoring suggestions for this opportunity yet." />
            ) : (
              <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto pr-1">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAccept={() => insight && acceptTailoringSuggestion(insight.id, suggestion.id, suggestion.section)}
                    onSkip={() => insight && dismissTailoringSuggestion(insight.id, suggestion.id, suggestion.section)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          {phase === "pick" ? (
            <Button onClick={handleStart} disabled={!canStart}>
              <Sparkles className="size-4" />
              Run Copilot pass
            </Button>
          ) : null}
          {phase === "review" ? (
            <Button onClick={handleCreate} disabled={acceptedCount === 0}>
              Create tailored version
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionCard({
  suggestion,
  onAccept,
  onSkip,
}: {
  suggestion: TailoringSuggestion;
  onAccept: () => void;
  onSkip: () => void;
}) {
  return (
    <Card className={cn("ring-foreground/8", suggestion.state === "dismissed" && "bg-muted/20")}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary">{suggestion.section}</Badge>
            <Badge variant="outline">{CHANGE_TYPE_LABEL[suggestion.changeType]}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={suggestion.state === "accepted" ? "default" : "outline"}
              onClick={onAccept}
            >
              <Check className="size-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant={suggestion.state === "dismissed" ? "secondary" : "ghost"}
              onClick={onSkip}
            >
              <X className="size-3.5" />
              Skip
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Current</span>
            <p className="text-xs text-muted-foreground">{suggestion.currentText}</p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Proposed</span>
            <p className="text-xs text-foreground">{suggestion.proposedText}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why: </span>
          {suggestion.rationale}
        </p>
      </CardContent>
    </Card>
  );
}
