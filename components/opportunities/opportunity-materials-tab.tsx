"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { CvVersion } from "@/lib/types";

/**
 * Structured layout for Materials: the linked CV version, plus a quiet
 * "Tailor for this role" stub pointing at the CVs surface. Ticket 10 builds
 * the real per-section tailoring workflow on top of this.
 */
export function OpportunityMaterialsTab({ cvVersion }: { cvVersion?: CvVersion }) {
  return (
    <div className="flex flex-col gap-3">
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
          message="No CV version linked yet. Link one from CV Versions to tailor it for this role."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/cvs">Go to CV Versions</Link>
            </Button>
          }
        />
      )}

      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground">Tailor for this role</span>
            <span className="text-xs text-muted-foreground">
              Opens the CV surface to start tailoring section by section.
            </span>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href={cvVersion ? `/cvs/${cvVersion.id}` : "/cvs"}>
              <Sparkles className="size-3.5" />
              Tailor for this role
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
