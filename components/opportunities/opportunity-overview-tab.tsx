"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { resolveOpportunitySurface } from "@/lib/copilot-utils";
import { useStore } from "@/lib/store";
import type { CvVersion, Goal, Opportunity, SummaryInsight } from "@/lib/types";

interface OpportunityOverviewTabProps {
  opportunity: Opportunity;
  summary?: SummaryInsight;
  cvVersion?: CvVersion;
  relatedGoals: Goal[];
}

export function OpportunityOverviewTab({
  opportunity,
  summary,
  cvVersion,
  relatedGoals,
}: OpportunityOverviewTabProps) {
  const { setOpportunityNotes, setGoalHighlight } = useStore();
  const [notesDraft, setNotesDraft] = useState(opportunity.notes ?? "");
  const [sourceExpanded, setSourceExpanded] = useState(false);

  const notesDirty = notesDraft !== (opportunity.notes ?? "");
  const objectLabel = `${opportunity.role} at ${opportunity.company}`;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2 flex flex-col gap-3">
        <div className="flex justify-end">
          <AskCopilotButton surface={resolveOpportunitySurface(opportunity.company)} objectLabel={objectLabel} />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Role summary</CardTitle>
              <CopilotTag />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              {summary?.body ?? "Copilot hasn't summarized this listing yet."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Extracted highlights</CardTitle>
              <CopilotTag />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {opportunity.responsibilities?.length || opportunity.requirements?.length ? (
              <>
                <HighlightList title="Responsibilities" items={opportunity.responsibilities} />
                <HighlightList title="Requirements" items={opportunity.requirements} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Copilot hasn&apos;t extracted responsibilities or requirements from this listing yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>About the company</CardTitle>
              <CopilotTag />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              {opportunity.companyContext ?? "Copilot hasn't compiled company context for this one yet."}
            </p>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-lg border border-dashed border-border bg-muted/20">
          <button
            type="button"
            onClick={() => setSourceExpanded((current) => !current)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={sourceExpanded}
          >
            Source content, raw
            {sourceExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {sourceExpanded ? (
            <div className="border-t border-dashed border-border px-4 py-3">
              <p className="break-words text-sm text-muted-foreground">{opportunity.description}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="col-span-1 flex flex-col gap-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Key facts</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2 text-sm">
              <Fact label="Saved" value={opportunity.savedAt} />
              {opportunity.appliedAt ? <Fact label="Applied" value={opportunity.appliedAt} /> : null}
              <Fact label="Last activity" value={opportunity.lastActivityAt} />
              <Fact label="Source" value={opportunity.source} />
            </dl>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Linked CV version</CardTitle>
          </CardHeader>
          <CardContent>
            {cvVersion ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground">{cvVersion.name}</span>
                <span className="text-xs text-muted-foreground">
                  {cvVersion.kind === "tailored" ? "Tailored version" : "Base version"}
                </span>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href={`/cvs/${cvVersion.id}`}>Open CV</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-muted-foreground">No CV version linked yet.</p>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href="/cvs">Go to CV Versions</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Related goal</CardTitle>
          </CardHeader>
          <CardContent>
            {relatedGoals.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {relatedGoals.map((goal) => (
                  <Link
                    key={goal.id}
                    href="/goals"
                    onClick={() => setGoalHighlight(goal.id)}
                    className="text-sm text-foreground underline-offset-2 hover:underline"
                  >
                    {goal.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No related goal linked yet.</p>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Textarea
              rows={4}
              value={notesDraft}
              placeholder="What's worth remembering about this one"
              onChange={(event) => setNotesDraft(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              disabled={!notesDirty}
              onClick={() => setOpportunityNotes(opportunity.id, notesDraft)}
            >
              Save note
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function HighlightList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
