"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewCvVersionDialog } from "@/components/cvs/new-cv-version-dialog";
import { useStore } from "@/lib/store";
import type { CvVersion, Opportunity } from "@/lib/types";

const UNLINKED_VALUE = "none";

/**
 * The CV detail's meta rail: version facts, the opportunity link (settable
 * from a select of current opportunities), a one-line "used for" summary,
 * and the duplicate action.
 */
export function CvMetaRail({
  cv,
  linkedOpportunity,
}: {
  cv: CvVersion;
  linkedOpportunity?: Opportunity;
}) {
  const { state, setCvOpportunityLink } = useStore();
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  function handleLinkChange(value: string) {
    setCvOpportunityLink(cv.id, value === UNLINKED_VALUE ? undefined : value);
  }

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Version info</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Kind</span>
            <Badge variant={cv.kind === "tailored" ? "default" : "secondary"} className="capitalize">
              {cv.kind}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sections</span>
            <span className="text-foreground">{cv.sections.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last edited</span>
            <span className="text-foreground">{cv.lastEditedAt}</span>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Linked opportunity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Set which opportunity this version is for</Label>
          <Select value={cv.opportunityId ?? UNLINKED_VALUE} onValueChange={handleLinkChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Not linked" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNLINKED_VALUE}>Not linked</SelectItem>
              {state.opportunities.map((opportunity) => (
                <SelectItem key={opportunity.id} value={opportunity.id}>
                  {opportunity.role} at {opportunity.company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {linkedOpportunity ? (
            <Link
              href={`/opportunities/${linkedOpportunity.id}`}
              className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
            >
              Open {linkedOpportunity.company}
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Used for</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {linkedOpportunity
            ? `Tailored for ${linkedOpportunity.role} at ${linkedOpportunity.company}, currently in ${linkedOpportunity.status}.`
            : "Not currently tailored to an opportunity."}
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" onClick={() => setDuplicateOpen(true)}>
        <Copy className="size-3.5" />
        Duplicate this version
      </Button>

      <NewCvVersionDialog open={duplicateOpen} onOpenChange={setDuplicateOpen} defaultSourceId={cv.id} />
    </>
  );
}
