"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { Button } from "@/components/ui/button";
import { RecruiterAttentionStrip } from "@/components/recruiter/recruiter-attention-strip";
import { RecruiterControls } from "@/components/recruiter/recruiter-controls";
import { RecruiterPipelineBoard } from "@/components/recruiter/recruiter-pipeline-board";
import { RecruiterPipelineList } from "@/components/recruiter/recruiter-pipeline-list";
import {
  compareRecruiterCandidates,
  matchesRecruiterFilters,
  type RecruiterCandidateSort,
  type RecruiterReadinessFilter,
  type RecruiterRoleFilter,
  type RecruiterSourceFilter,
} from "@/lib/recruiter-utils";
import { today, useCopilotSurface, useStore } from "@/lib/store";

type RecruiterView = "board" | "list";

export default function RecruiterPipelinePage() {
  useCopilotSurface("Recruiter Pipeline");
  const { state } = useStore();

  const [view, setView] = useState<RecruiterView>("board");
  const [role, setRole] = useState<RecruiterRoleFilter>("all");
  const [readiness, setReadiness] = useState<RecruiterReadinessFilter>("all");
  const [source, setSource] = useState<RecruiterSourceFilter>("all");
  const [sort, setSort] = useState<RecruiterCandidateSort>("days-in-stage");

  const todayIso = today();

  // The Roles index's "View pipeline" link deep-links here with a `role`
  // query param, the same direct-URL-read convention the candidate-side
  // Opportunities page already uses for its own `status` param.
  useEffect(() => {
    function syncRoleFromQuery() {
      const param = new URLSearchParams(window.location.search).get("role");
      if (param && state.recruiterRoles.some((item) => item.id === param)) {
        setRole(param);
      }
    }
    syncRoleFromQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => state.recruiterCandidates.filter((candidate) => matchesRecruiterFilters(candidate, { role, readiness, source })),
    [state.recruiterCandidates, role, readiness, source]
  );

  const sorted = useMemo(
    () => [...filtered].sort(compareRecruiterCandidates(sort, todayIso)),
    [filtered, sort, todayIso]
  );

  return (
    <WorkspacePage
      title="Pipeline"
      description={`${state.recruiterCandidates.length} candidates across ${state.recruiterRoles.length} open roles.`}
      primaryAction={
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          <Button size="sm" variant={view === "board" ? "secondary" : "ghost"} aria-pressed={view === "board"} onClick={() => setView("board")}>
            <LayoutGrid className="size-4" />
            Board
          </Button>
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} aria-pressed={view === "list"} onClick={() => setView("list")}>
            <Rows3 className="size-4" />
            List
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <RecruiterAttentionStrip candidates={state.recruiterCandidates} />

        <RecruiterControls
          roles={state.recruiterRoles}
          role={role}
          onRoleChange={setRole}
          readiness={readiness}
          onReadinessChange={setReadiness}
          source={source}
          onSourceChange={setSource}
          resultCount={filtered.length}
          totalCount={state.recruiterCandidates.length}
        />

        {view === "board" ? (
          <RecruiterPipelineBoard candidates={filtered} />
        ) : (
          <RecruiterPipelineList
            candidates={sorted}
            roles={state.recruiterRoles}
            sort={sort}
            onSortChange={setSort}
          />
        )}
      </div>
    </WorkspacePage>
  );
}
