"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { FitChip } from "@/components/shared/fit-chip";
import type { CredibilityInsight, FitInsight, SummaryInsight } from "@/lib/types";

interface OpportunityAiAnalysisTabProps {
  summary?: SummaryInsight;
  credibility?: CredibilityInsight;
  fit?: FitInsight;
}

/**
 * Structured scaffold for the opportunity's AI understanding: summary,
 * credibility check, then the fit judgment broken into strengths, concerns,
 * and unknowns. Ticket 07 deepens this with follow-up interactions.
 */
export function OpportunityAiAnalysisTab({ summary, credibility, fit }: OpportunityAiAnalysisTabProps) {
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Summary</CardTitle>
            <CopilotTag />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            {summary?.body ?? "Copilot hasn't summarized this opportunity yet."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Credibility check</CardTitle>
            <div className="flex items-center gap-1.5">
              {credibility ? (
                <>
                  <Badge
                    className={
                      credibility.verdict === "pass"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    }
                  >
                    {credibility.verdict === "pass" ? "Passes checks" : "Fails checks"}
                  </Badge>
                  <ConfidenceChip confidence={credibility.confidence} />
                </>
              ) : null}
              <CopilotTag />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {credibility ? (
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {credibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Copilot hasn&apos;t run a credibility check on this listing yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fit judgment</CardTitle>
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Copilot hasn&apos;t judged fit for this opportunity yet.</p>
          )}
        </CardContent>
      </Card>
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
