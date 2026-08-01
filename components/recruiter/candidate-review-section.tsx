import { Check, Circle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import type { RecruiterReviewScaffold } from "@/lib/types";

const STATUS_TONE: Record<RecruiterReviewScaffold["status"], keyof typeof CHIP_TONES> = {
  "Not started": "neutral",
  "In progress": "warning",
  Complete: "success",
};

/**
 * A real, if compact, review checklist, the pattern ticket 06 established
 * for opportunity detail tabs: structured content now, that RDS-30 deepens
 * into a full review workflow.
 */
export function CandidateReviewSection({ review }: { review: RecruiterReviewScaffold }) {
  const tone = CHIP_TONES[STATUS_TONE[review.status]];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Review</CardTitle>
          <Chip label={review.status} dotClassName={tone.dot} className={tone.className} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{review.summary}</p>
        <ul className="flex flex-col gap-1.5">
          {review.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
