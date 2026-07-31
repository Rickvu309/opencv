"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function CvDetailPage() {
  const params = useParams<{ id: string }>();
  const { state } = useStore();
  const cv = state.cvVersions.find((item) => item.id === params.id);

  useCopilotSurface("CV Versions", cv?.name);

  if (!cv) {
    return (
      <div className="flex flex-col">
        <PageHeader title="CV not found" />
        <div className="p-6">
          <EmptyState
            message="This CV version doesn't exist, or was removed."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/cvs">Back to CV Versions</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const linkedOpportunity = cv.opportunityId
    ? state.opportunities.find((opportunity) => opportunity.id === cv.opportunityId)
    : undefined;

  return (
    <div className="flex flex-col">
      <PageHeader title={cv.name} description={`Last edited ${cv.lastEditedAt}`} />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={cv.kind === "tailored" ? "default" : "secondary"} className="capitalize">
            {cv.kind}
          </Badge>
          {linkedOpportunity ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/opportunities/${linkedOpportunity.id}`}>
                Tailored for {linkedOpportunity.role} at {linkedOpportunity.company}
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          {cv.sections.map((section) => (
            <Card key={section.id}>
              <CardContent className="flex flex-col gap-1.5">
                <h3>{section.title}</h3>
                <p className="text-sm text-muted-foreground">{section.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
