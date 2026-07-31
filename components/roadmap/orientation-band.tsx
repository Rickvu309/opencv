import { ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LEVEL_LABELS } from "@/lib/data/skills";
import type { RoadmapProgress } from "@/lib/roadmap-utils";
import type { PathScenario, Profile, Skill } from "@/lib/types";

interface RoadmapOrientationBandProps {
  profile: Profile;
  scenario: PathScenario;
  orientationSkills: Skill[];
  progress: RoadmapProgress;
}

/**
 * Zone 1: one band, two poles and a bridge. Now (current role plus the 2
 * strongest skills relevant to this path) on the left, Target (the working
 * path and how long until it's viable) on the right, and the bridge between
 * them naming the live gap count and overall roadmap progress. Reused
 * scenario.timeToViable rather than a new field, so this stays in lockstep
 * with whatever the Path Planner already says about the same scenario.
 */
export function RoadmapOrientationBand({ profile, scenario, orientationSkills, progress }: RoadmapOrientationBandProps) {
  const gapsRemaining = progress.total - progress.done;

  return (
    <Card className="rounded-none border-x-0 border-t-0 ring-0">
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-section-label">Now</span>
          <p className="text-sm font-medium text-foreground">{profile.currentRole}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {orientationSkills.map((skill) => (
              <span key={skill.id}>
                {skill.name}: <span className="text-foreground">{LEVEL_LABELS[skill.level]}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1.5 px-2">
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {gapsRemaining > 0
              ? `${gapsRemaining} ${gapsRemaining === 1 ? "gap" : "gaps"} left to close`
              : "All gaps closed"}
          </span>
          <div className="w-36">
            <Progress value={progress.percent} />
          </div>
          <span className="text-[11px] text-muted-foreground">{progress.percent}% of the roadmap</span>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 lg:items-end lg:text-right">
          <span className="text-section-label">Target</span>
          <p className="text-sm font-medium text-foreground">{scenario.title}</p>
          <p className="text-xs text-muted-foreground">Viable in {scenario.timeToViable}</p>
        </div>
      </CardContent>
    </Card>
  );
}
