"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Chip } from "@/components/shared/chip";
import { LinkChip } from "@/components/shared/link-chip";
import { SkillLevelMeter } from "@/components/skills/skill-level-meter";
import { useStore } from "@/lib/store";
import type { Opportunity, Skill, TrackRecordEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SkillRowProps {
  skill: Skill;
  trackRecordEntries: TrackRecordEntry[];
  opportunities: Opportunity[];
  highlighted?: boolean;
}

/**
 * One skill in the skill map. Collapsed shows the scannable anatomy (name,
 * level meter, gap flag, focus star). Expanding adds where the skill shows
 * up in confirmed Track Record evidence, which opportunities' fit analysis
 * names it, and its one-line target-direction relevance.
 */
export function SkillRow({ skill, trackRecordEntries, opportunities, highlighted }: SkillRowProps) {
  const { toggleSkillFocus, setTrackRecordHighlight } = useStore();
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const expanded = manuallyExpanded || Boolean(highlighted);

  useEffect(() => {
    if (highlighted) {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  const evidenceEntries = (skill.trackRecordEntryIds ?? [])
    .map((id) => trackRecordEntries.find((entry) => entry.id === id))
    .filter((entry): entry is TrackRecordEntry => Boolean(entry))
    .filter((entry) => entry.status === "confirmed");

  const requiredByOpportunities = (skill.relatedOpportunityIds ?? [])
    .map((id) => opportunities.find((opportunity) => opportunity.id === id))
    .filter((opportunity): opportunity is Opportunity => Boolean(opportunity));

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-transparent px-1.5 py-1.5 transition-colors",
        highlighted && "border-primary ring-2 ring-primary"
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setManuallyExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex flex-1 flex-col gap-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-foreground">{skill.name}</span>
            {skill.isGap ? (
              <Chip label="Gap" className="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" />
            ) : null}
          </div>
          <SkillLevelMeter level={skill.level} targetLevel={skill.targetLevel} />
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-pressed={skill.isFocus}
            aria-label={skill.isFocus ? "Remove focus" : "Mark as focus"}
            onClick={() => toggleSkillFocus(skill.id)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <Star className={cn("size-3.5", skill.isFocus && "fill-amber-400 text-amber-500")} />
          </button>
          <button
            type="button"
            aria-label={expanded ? "Collapse skill details" : "Expand skill details"}
            onClick={() => setManuallyExpanded(!expanded)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          <Separator />

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Target-direction relevance</span>
            <p className="text-xs text-foreground">{skill.targetDirectionRelevance}</p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Where this shows up</span>
            {evidenceEntries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {evidenceEntries.map((entry) => (
                  <LinkChip key={entry.id} href="/track-record" onClick={() => setTrackRecordHighlight(entry.id)}>
                    {entry.title}
                  </LinkChip>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No confirmed Track Record evidence yet.</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Required by</span>
            {requiredByOpportunities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {requiredByOpportunities.map((opportunity) => (
                  <LinkChip key={opportunity.id} href={`/opportunities/${opportunity.id}#ai-analysis`}>
                    {opportunity.company}
                  </LinkChip>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No active opportunity&apos;s fit analysis names this directly.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
