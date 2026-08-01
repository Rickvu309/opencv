"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, Flag } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { RecruiterReadinessChip } from "@/components/recruiter/recruiter-readiness-chip";
import { RecruiterSourceChip } from "@/components/recruiter/recruiter-source-chip";
import { RecruiterStageChip } from "@/components/recruiter/recruiter-stage-chip";
import { RecruiterQuickActionsMenu } from "@/components/recruiter/recruiter-quick-actions-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { daysInStage, findRecruiterRole, isStaleInStage, type RecruiterCandidateSort } from "@/lib/recruiter-utils";
import { today } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { RecruiterCandidate, RecruiterRole } from "@/lib/types";

interface RecruiterPipelineListProps {
  candidates: RecruiterCandidate[];
  roles: RecruiterRole[];
  sort: RecruiterCandidateSort;
  onSortChange: (sort: RecruiterCandidateSort) => void;
  /** /recruiter/candidates shows a Role column since it spans every role; /recruiter's own list view already has a role select above it. */
  showRoleColumn?: boolean;
}

/** Sortable list view, mirroring OpportunityListView's shape for the same scanning pattern across both persona modes (Jakob's Law). */
export function RecruiterPipelineList({ candidates, roles, sort, onSortChange, showRoleColumn = true }: RecruiterPipelineListProps) {
  const router = useRouter();
  const todayIso = today();

  if (candidates.length === 0) {
    return <EmptyState message="No candidates match this view. Adjust the filters." />;
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Candidate</TableHead>
            {showRoleColumn ? <TableHead>Role</TableHead> : null}
            <TableHead>Stage</TableHead>
            <SortableHead label="Readiness" active={sort === "readiness"} onClick={() => onSortChange("readiness")} />
            <SortableHead
              label="Days in stage"
              active={sort === "days-in-stage"}
              onClick={() => onSortChange("days-in-stage")}
            />
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => {
            const role = findRecruiterRole(candidate.roleId, roles);
            const days = daysInStage(candidate, todayIso);
            const stale = isStaleInStage(candidate, todayIso);

            return (
              <TableRow
                key={candidate.id}
                className="cursor-pointer"
                onClick={() => router.push(`/recruiter/candidates/${candidate.id}`)}
              >
                <TableCell className="max-w-56 whitespace-normal">
                  <div className="flex items-center gap-1.5">
                    {candidate.flaggedForReview ? (
                      <Flag className="size-3 shrink-0 fill-amber-500 text-amber-500" />
                    ) : null}
                    <span className="truncate font-medium text-foreground">{candidate.name}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {candidate.currentTitle} at {candidate.currentCompany}
                  </div>
                </TableCell>
                {showRoleColumn ? (
                  <TableCell className="text-muted-foreground">{role?.title ?? "—"}</TableCell>
                ) : null}
                <TableCell>
                  <RecruiterStageChip stage={candidate.stage} />
                </TableCell>
                <TableCell>
                  <RecruiterReadinessChip readiness={candidate.readiness} />
                </TableCell>
                <TableCell className={cn(stale && "font-medium text-rose-600 dark:text-rose-400")}>
                  {days} {days === 1 ? "day" : "days"}
                </TableCell>
                <TableCell>
                  <RecruiterSourceChip source={candidate.source} />
                </TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                  <RecruiterQuickActionsMenu candidate={candidate} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SortableHead({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 font-medium",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
        {active ? <ArrowDown className="size-3" /> : null}
      </button>
    </TableHead>
  );
}
