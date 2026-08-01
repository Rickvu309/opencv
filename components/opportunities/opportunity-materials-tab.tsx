"use client";

import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { TailoringDialog } from "@/components/cvs/tailoring-dialog";
import { TrackRecordEvidenceChip } from "@/components/proof/track-record-evidence-chip";
import { resolveOpportunitySurface } from "@/lib/copilot-utils";
import { useStore } from "@/lib/store";
import type { CvVersion, Opportunity, TrackRecordEntry } from "@/lib/types";

interface OpportunityMaterialsTabProps {
  opportunity: Opportunity;
  cvVersion?: CvVersion;
}

/**
 * Materials: link a CV version to this opportunity, then hand off into the
 * shared tailoring flow. The other entry point to the same flow lives on the
 * CV detail page's "Tailor for this role" button.
 */
export function OpportunityMaterialsTab({ opportunity, cvVersion }: OpportunityMaterialsTabProps) {
  const { state, setCvOpportunityLink } = useStore();
  const objectLabel = `${opportunity.role} at ${opportunity.company}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <AskCopilotButton surface={resolveOpportunitySurface(opportunity.company)} objectLabel={objectLabel} />
      </div>

      {cvVersion ? (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{cvVersion.name}</span>
              <span className="text-xs text-muted-foreground">
                {cvVersion.kind === "tailored" ? "Tailored version" : "Base version"} · last edited{" "}
                {cvVersion.lastEditedAt}
              </span>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/cvs/${cvVersion.id}`}>Open CV</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          message="No CV version linked yet. Pick one below, or create one from CV Versions."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/cvs">Go to CV Versions</Link>
            </Button>
          }
        />
      )}

      <Card>
        <CardContent className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Link a CV version to this opportunity</Label>
          <Select
            value={cvVersion?.id ?? ""}
            onValueChange={(value) => setCvOpportunityLink(value, opportunity.id)}
          >
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
        </CardContent>
      </Card>

      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground">Tailor for this role</span>
            <span className="text-xs text-muted-foreground">
              Copilot drafts section-by-section suggestions tied to the fit analysis, you accept or skip
              each one before creating a new tailored version.
            </span>
          </div>
          <TailoringDialog
            fixedOpportunity={opportunity}
            defaultCvId={cvVersion?.id}
            trigger={
              <Button size="sm" variant="ghost" disabled={state.cvVersions.length === 0}>
                <Sparkles className="size-3.5" />
                Tailor for this role
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Positioning notes</span>
              {opportunity.positioningNotes && opportunity.positioningNotes.length > 0 ? <CopilotTag /> : null}
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/proof?context=opportunity&opportunityId=${opportunity.id}`}>
                <ShieldCheck className="size-3.5" />
                Build proof for this opportunity
              </Link>
            </Button>
          </div>
          {opportunity.positioningNotes && opportunity.positioningNotes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {opportunity.positioningNotes.map((note) => {
                const backingEntries = note.backingEntryIds
                  .map((id) => state.trackRecordEntries.find((entry) => entry.id === id))
                  .filter((entry): entry is TrackRecordEntry => Boolean(entry));
                return (
                  <div key={note.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-sm text-foreground">{note.text}</p>
                    {backingEntries.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">
                          Evidence
                        </Badge>
                        {backingEntries.map((entry) => (
                          <TrackRecordEvidenceChip key={entry.id} entry={entry} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              message="No positioning notes yet. Build proof for this opportunity to attach one."
              className="border-none bg-transparent px-0 py-2 text-left"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
