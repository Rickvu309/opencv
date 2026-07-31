"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ObjectCard } from "@/components/shared/object-card";
import { EmptyState } from "@/components/shared/empty-state";
import { CvQuickActionsMenu } from "@/components/cvs/cv-quick-actions-menu";
import { NewCvVersionDialog } from "@/components/cvs/new-cv-version-dialog";
import { DeleteCvDialog } from "@/components/cvs/delete-cv-dialog";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { CvVersion } from "@/lib/types";

export default function CvsPage() {
  useCopilotSurface("CV Versions");
  const { state } = useStore();

  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<CvVersion | null>(null);

  function openNewVersion(sourceId?: string) {
    setDuplicateSourceId(sourceId);
    setNewVersionOpen(true);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="CV Versions"
        description={`${state.cvVersions.length} versions, base and tailored.`}
        primaryAction={
          <Button size="sm" onClick={() => openNewVersion(undefined)}>
            <Plus className="size-4" />
            New version
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 p-6">
        {state.cvVersions.length === 0 ? (
          <div className="col-span-2">
            <EmptyState message="No CV versions yet. Create a base CV to start tailoring it per opportunity." />
          </div>
        ) : (
          state.cvVersions.map((cv) => {
            const linkedOpportunity = cv.opportunityId
              ? state.opportunities.find((opportunity) => opportunity.id === cv.opportunityId)
              : undefined;
            return (
              <ObjectCard
                key={cv.id}
                title={cv.name}
                subtitle={`${cv.sections.length} sections · last edited ${cv.lastEditedAt}`}
                href={`/cvs/${cv.id}`}
                chips={
                  <>
                    <Badge variant={cv.kind === "tailored" ? "default" : "secondary"} className="capitalize">
                      {cv.kind}
                    </Badge>
                    {linkedOpportunity ? (
                      <Badge variant="outline">{linkedOpportunity.company}</Badge>
                    ) : null}
                  </>
                }
                action={
                  <CvQuickActionsMenu
                    cv={cv}
                    onDuplicate={() => openNewVersion(cv.id)}
                    onDelete={() => setDeleteTarget(cv)}
                  />
                }
              />
            );
          })
        )}
      </div>

      <NewCvVersionDialog
        open={newVersionOpen}
        onOpenChange={setNewVersionOpen}
        defaultSourceId={duplicateSourceId}
      />
      <DeleteCvDialog cv={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
