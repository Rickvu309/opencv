"use client";

import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function CvsPage() {
  useCopilotSurface("CV Versions");
  const { state } = useStore();

  return (
    <div className="flex flex-col">
      <PageHeader title="CV Versions" description={`${state.cvVersions.length} versions, base and tailored.`} />

      <div className="flex flex-col gap-3 p-6">
        {state.cvVersions.length === 0 ? (
          <EmptyState message="No CV versions yet. Create a base CV to start tailoring it per opportunity." />
        ) : (
          state.cvVersions.map((cv) => {
            const linkedOpportunity = cv.opportunityId
              ? state.opportunities.find((opportunity) => opportunity.id === cv.opportunityId)
              : undefined;
            return (
              <Card key={cv.id} className="ring-foreground/8">
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <CardTitle>{cv.name}</CardTitle>
                      <CardDescription>
                        {cv.sections.length} sections · last edited {cv.lastEditedAt}
                      </CardDescription>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/cvs/${cv.id}`}>Open</Link>
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={cv.kind === "tailored" ? "default" : "secondary"} className="capitalize">
                      {cv.kind}
                    </Badge>
                    {linkedOpportunity ? (
                      <Badge variant="outline" asChild>
                        <Link href={`/opportunities/${linkedOpportunity.id}`}>
                          Linked to {linkedOpportunity.company}
                        </Link>
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
