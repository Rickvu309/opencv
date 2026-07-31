import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SkillAreaCoverage } from "@/lib/track-record-utils";

interface CoverageRailProps {
  confirmedCount: number;
  candidateCount: number;
  coverage: SkillAreaCoverage[];
}

/**
 * Track Record's quiet support rail: how much evidence exists, how much is
 * still waiting on review, and which skill areas it backs. A read-only
 * echo of the timeline below, sized and toned like the other Career Memory
 * rails (Profile's strength card, the CV meta rail).
 */
export function CoverageRail({ confirmedCount, candidateCount, coverage }: CoverageRailProps) {
  return (
    <div className="flex w-64 shrink-0 flex-col gap-3">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Coverage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Confirmed entries</span>
            <span className="text-foreground">{confirmedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Awaiting review</span>
            <span className="text-foreground">{candidateCount}</span>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>By skill area</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {coverage.length === 0 ? (
            <p className="text-muted-foreground">No confirmed entries link to a skill yet.</p>
          ) : (
            coverage.map((item) => (
              <div key={item.area} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">{item.area}</span>
                <span className="text-foreground">{item.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
