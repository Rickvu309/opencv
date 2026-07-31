"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Quote, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiThinking } from "@/components/shared/ai-thinking";
import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { Chip } from "@/components/shared/chip";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { CredibilityChip } from "@/components/shared/credibility-chip";
import { ExpandableRow } from "@/components/shared/expandable-row";
import { FitChip } from "@/components/shared/fit-chip";
import { WhyThisReading } from "@/components/shared/why-this-reading";
import { resolveOpportunitySurface } from "@/lib/copilot-utils";
import type { CredibilityInsight, FitInsight, InterpretationInsight, Opportunity } from "@/lib/types";

interface OpportunityAiAnalysisTabProps {
  opportunity: Opportunity;
  interpretation?: InterpretationInsight;
  credibility?: CredibilityInsight;
  fit?: FitInsight;
  onGoToActions: () => void;
}

/**
 * The AI Analysis tab: three connected layers on one opportunity.
 * Interpretation reads what the role is really asking for, Validation
 * judges whether the listing itself is worth attention, and Judgment
 * scores fit against Mai's actual profile. Every block carries a Copilot
 * tag and an expandable "Why this reading" rationale, and the tab footer
 * hands off to deciding a next step or asking Copilot a scripted follow-up.
 */
export function OpportunityAiAnalysisTab({
  opportunity,
  interpretation,
  credibility,
  fit,
  onGoToActions,
}: OpportunityAiAnalysisTabProps) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    };
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    refreshTimeout.current = setTimeout(() => setRefreshing(false), 600 + Math.random() * 600);
  }

  const objectLabel = `${opportunity.role} at ${opportunity.company}`;
  const hasAnyLayer = Boolean(interpretation || credibility || fit);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Three-layer read: what it asks for, whether it holds up, and how it fits you.
        </p>
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
          Refresh analysis
        </Button>
      </div>

      {refreshing ? (
        <Card>
          <CardContent>
            <AiThinking label="Refreshing analysis" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Layer 1: Interpretation */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>What this role really asks for</CardTitle>
                <div className="flex items-center gap-1.5">
                  {interpretation ? <ConfidenceChip confidence={interpretation.confidence} /> : null}
                  <CopilotTag />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {interpretation ? (
                <>
                  <p className="text-sm font-medium text-foreground">{interpretation.plainLanguageRead}</p>
                  <div className="flex flex-col gap-1.5">
                    {interpretation.expectations.map((expectation) => (
                      <ExpandableRow
                        key={expectation.id}
                        label={expectation.label}
                        detail={expectation.rationale}
                      />
                    ))}
                    <ExpandableRow
                      label={
                        <span className="flex items-center gap-1.5">
                          <Chip
                            label="Vague language decoded"
                            icon={<Quote className="size-3" />}
                            className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          />
                          <span className="italic text-muted-foreground">
                            &ldquo;{interpretation.vagueLanguage.phrase}&rdquo;
                          </span>
                        </span>
                      }
                      detail={interpretation.vagueLanguage.decoded}
                      tone="caution"
                    />
                  </div>
                  <WhyThisReading text={interpretation.whyThisReading} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Copilot hasn&apos;t interpreted this listing yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Layer 2: Validation */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Is this worth your attention</CardTitle>
                <div className="flex items-center gap-1.5">
                  {credibility ? (
                    <>
                      <CredibilityChip verdict={credibility.verdict} />
                      <ConfidenceChip confidence={credibility.confidence} />
                    </>
                  ) : null}
                  <CopilotTag />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {credibility ? (
                <>
                  <SignalGroup label="Positive signals" signals={credibility.positiveSignals} />
                  <SignalGroup label="Caution signals" signals={credibility.cautionSignals} tone="caution" />
                  <WhyThisReading text={credibility.whyThisReading} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Copilot hasn&apos;t run a credibility check on this listing yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Layer 3: Judgment */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>How it fits you</CardTitle>
                <div className="flex items-center gap-1.5">
                  {fit ? (
                    <>
                      <FitChip fit={fit.level} />
                      <ConfidenceChip confidence={fit.confidence} />
                    </>
                  ) : null}
                  <CopilotTag />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {fit ? (
                <>
                  <FitSection label="Strengths" items={fit.strengths} />
                  <FitSection label="Concerns" items={fit.concerns} />
                  <FitSection label="Unknowns" items={fit.unknowns} />
                  <div className="rounded-lg border border-dashed border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Tradeoff</p>
                    <p className="mt-1 text-sm text-foreground">
                      You gain: {fit.tradeoff.gain}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      You give up: {fit.tradeoff.give}
                    </p>
                  </div>
                  <p className="text-sm text-foreground">{fit.alignmentLine}</p>
                  <WhyThisReading text={fit.whyThisReading} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Copilot hasn&apos;t judged fit for this opportunity yet.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {hasAnyLayer ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">Ready to act on this reading?</p>
          <div className="flex items-center gap-2">
            <AskCopilotButton
              surface={resolveOpportunitySurface(opportunity.company)}
              objectLabel={objectLabel}
              label="Ask a follow-up"
              className="border border-border"
            />
            <Button size="sm" onClick={onGoToActions}>
              Decide next step
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FitSection({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SignalGroup({
  label,
  signals,
  tone = "default",
}: {
  label: string;
  signals: { id: string; label: string; why: string }[];
  tone?: "default" | "caution";
}) {
  if (signals.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {signals.map((signal) => (
        <ExpandableRow key={signal.id} label={signal.label} detail={signal.why} tone={tone} />
      ))}
    </div>
  );
}
