"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { Input } from "@/components/ui/input";
import { RecruiterPipelineList } from "@/components/recruiter/recruiter-pipeline-list";
import { compareRecruiterCandidates, type RecruiterCandidateSort } from "@/lib/recruiter-utils";
import { today, useCopilotSurface, useStore } from "@/lib/store";

export default function RecruiterCandidatesPage() {
  useCopilotSurface("Recruiter Candidates");
  const { state } = useStore();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RecruiterCandidateSort>("days-in-stage");
  const todayIso = today();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query
      ? state.recruiterCandidates.filter((candidate) => candidate.name.toLowerCase().includes(query))
      : state.recruiterCandidates;
    return [...matches].sort(compareRecruiterCandidates(sort, todayIso));
  }, [state.recruiterCandidates, search, sort, todayIso]);

  return (
    <WorkspacePage
      title="Candidates"
      description={`${state.recruiterCandidates.length} candidates across every open role.`}
    >
      <div className="flex flex-col gap-4">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
            aria-label="Search candidates by name"
            className="pl-8"
          />
        </div>

        <RecruiterPipelineList
          candidates={filtered}
          roles={state.recruiterRoles}
          sort={sort}
          onSortChange={setSort}
        />
      </div>
    </WorkspacePage>
  );
}
