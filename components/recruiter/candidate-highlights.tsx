import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecruiterCandidate } from "@/lib/types";

export function CandidateHighlights({ candidate }: { candidate: RecruiterCandidate }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Highlights</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1.5">
          {candidate.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
              {highlight}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
