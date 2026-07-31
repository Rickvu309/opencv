"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CvSectionCard } from "@/components/cvs/cv-section-card";
import { CvMetaRail } from "@/components/cvs/cv-meta-rail";
import { TailoringDialog } from "@/components/cvs/tailoring-dialog";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function CvDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
              <Button size="sm" variant="outline" onClick={() => router.push("/cvs")}>
                Back to CV Versions
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
      <PageHeader
        title={cv.name}
        description={`Last edited ${cv.lastEditedAt}`}
        primaryAction={
          <TailoringDialog
            fixedCv={cv}
            trigger={
              <Button size="sm">
                <Sparkles className="size-4" />
                Tailor for this role
              </Button>
            }
          />
        }
      />

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

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-3">
            {cv.sections.map((section) => (
              <CvSectionCard key={section.id} cvId={cv.id} section={section} />
            ))}
          </div>

          <CvMetaRail cv={cv} linkedOpportunity={linkedOpportunity} />
        </div>
      </div>
    </div>
  );
}
