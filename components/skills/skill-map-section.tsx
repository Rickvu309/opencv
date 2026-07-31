import { Card, CardContent } from "@/components/ui/card";
import { SkillRow } from "@/components/skills/skill-row";
import type { Opportunity, Skill, TrackRecordEntry } from "@/lib/types";

interface SkillMapSectionProps {
  skills: Skill[];
  trackRecordEntries: TrackRecordEntry[];
  opportunities: Opportunity[];
  highlightedSkillId?: string;
}

/**
 * Zone 1: the skill map, 12 skills grouped by category. Each row is its own
 * expandable SkillRow carrying level, gap flag, focus toggle, and the
 * evidence and requirement chips underneath.
 */
export function SkillMapSection({
  skills,
  trackRecordEntries,
  opportunities,
  highlightedSkillId,
}: SkillMapSectionProps) {
  const categories = Array.from(new Set(skills.map((skill) => skill.category)));

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {categories.map((category) => (
        <Card key={category} className="ring-foreground/8">
          <CardContent className="flex flex-col gap-1">
            <span className="px-1.5 text-xs font-semibold text-muted-foreground">{category}</span>
            <div className="flex flex-col gap-1">
              {skills
                .filter((skill) => skill.category === category)
                .map((skill) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    trackRecordEntries={trackRecordEntries}
                    opportunities={opportunities}
                    highlighted={skill.id === highlightedSkillId}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
