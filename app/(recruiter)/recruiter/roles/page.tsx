"use client";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { RecruiterRoleCard } from "@/components/recruiter/recruiter-role-card";
import { summarizeRecruiterRole } from "@/lib/recruiter-utils";
import { today, useCopilotSurface, useStore } from "@/lib/store";

export default function RecruiterRolesPage() {
  useCopilotSurface("Recruiter Roles");
  const { state } = useStore();
  const todayIso = today();

  const summaries = state.recruiterRoles.map((role) => summarizeRecruiterRole(role, state.recruiterCandidates, todayIso));

  return (
    <WorkspacePage title="Roles" description={`${state.recruiterRoles.length} open roles at Saola Labs.`}>
      <div className="grid grid-cols-2 gap-4">
        {summaries.map((summary) => (
          <RecruiterRoleCard key={summary.role.id} summary={summary} />
        ))}
      </div>
    </WorkspacePage>
  );
}
