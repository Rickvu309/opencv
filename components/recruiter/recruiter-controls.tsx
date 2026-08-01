"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RecruiterReadinessFilter, RecruiterRoleFilter, RecruiterSourceFilter } from "@/lib/recruiter-utils";
import type { RecruiterReadiness, RecruiterRole, RecruiterSource } from "@/lib/types";

const READINESS_OPTIONS: RecruiterReadiness[] = ["Ready to advance", "Needs review", "Blocked", "Stale"];
const SOURCE_OPTIONS: RecruiterSource[] = ["Referral", "Inbound", "Sourced"];

interface RecruiterControlsProps {
  roles: RecruiterRole[];
  role: RecruiterRoleFilter;
  onRoleChange: (role: RecruiterRoleFilter) => void;
  readiness: RecruiterReadinessFilter;
  onReadinessChange: (readiness: RecruiterReadinessFilter) => void;
  source: RecruiterSourceFilter;
  onSourceChange: (source: RecruiterSourceFilter) => void;
  resultCount: number;
  totalCount: number;
}

/**
 * The pipeline's 3 filter dimensions the brief asks for (role, readiness,
 * source), capped at exactly 3 selects plus a result count (Hick's Law), the
 * same one-row control shape OpportunitiesControls already establishes.
 */
export function RecruiterControls({
  roles,
  role,
  onRoleChange,
  readiness,
  onReadinessChange,
  source,
  onSourceChange,
  resultCount,
  totalCount,
}: RecruiterControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={role} onValueChange={(value) => onRoleChange(value as RecruiterRoleFilter)}>
          <SelectTrigger size="sm" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={readiness} onValueChange={(value) => onReadinessChange(value as RecruiterReadinessFilter)}>
          <SelectTrigger size="sm" aria-label="Filter by readiness">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All readiness</SelectItem>
            {READINESS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={source} onValueChange={(value) => onSourceChange(value as RecruiterSourceFilter)}>
          <SelectTrigger size="sm" aria-label="Filter by source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-xs text-muted-foreground">
        {resultCount} of {totalCount} candidates
      </span>
    </div>
  );
}
