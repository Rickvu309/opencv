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
import type { CvVersion, Opportunity } from "@/lib/types";

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

      <div className="flex flex-col gap-8 p-6">
        {state.cvVersions.length === 0 ? (
          <EmptyState message="No CV versions yet. Create a base CV to start tailoring it per opportunity." />
        ) : (
          <>
            <CvGroup
              label="Base versions"
              versions={state.cvVersions.filter((cv) => cv.kind === "base")}
              emptyMessage="No base version yet. Create one to start tailoring it per opportunity."
              opportunities={state.opportunities}
              onDuplicate={openNewVersion}
              onDelete={setDeleteTarget}
            />
            <CvGroup
              label="Tailored versions"
              versions={state.cvVersions.filter((cv) => cv.kind === "tailored")}
              emptyMessage="No tailored version yet. Duplicate a base version and tailor it for a specific opportunity."
              opportunities={state.opportunities}
              onDuplicate={openNewVersion}
              onDelete={setDeleteTarget}
            />
          </>
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

function CvGroup({
  label,
  versions,
  emptyMessage,
  opportunities,
  onDuplicate,
  onDelete,
}: {
  label: string;
  versions: CvVersion[];
  emptyMessage: string;
  opportunities: Opportunity[];
  onDuplicate: (sourceId: string) => void;
  onDelete: (cv: CvVersion) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>{label}</h2>
        <span className="text-xs text-muted-foreground">{versions.length}</span>
      </div>
      {versions.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {versions.map((cv) => {
            const linkedOpportunity = cv.opportunityId
              ? opportunities.find((opportunity) => opportunity.id === cv.opportunityId)
              : undefined;
            return (
              <ObjectCard
                key={cv.id}
                title={cv.name}
                subtitle={`${cv.sections.length} sections · last edited ${cv.lastEditedAt}`}
                href={`/cvs/${cv.id}`}
                chips={linkedOpportunity ? <Badge variant="outline">{linkedOpportunity.company}</Badge> : null}
                action={
                  <CvQuickActionsMenu
                    cv={cv}
                    onDuplicate={() => onDuplicate(cv.id)}
                    onDelete={() => onDelete(cv)}
                  />
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
