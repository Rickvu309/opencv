import { Mail, MessageCircle, Phone } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import type { RecruiterOutreachScaffold, RecruiterOutreachTouch } from "@/lib/types";

const CHANNEL_ICON: Record<RecruiterOutreachTouch["channel"], typeof Mail> = {
  Email: Mail,
  LinkedIn: MessageCircle,
  Phone: Phone,
};

const STATUS_TONE: Record<RecruiterOutreachScaffold["status"], keyof typeof CHIP_TONES> = {
  "Not started": "neutral",
  "Awaiting reply": "warning",
  Responded: "success",
};

/** The touch log plus a scripted suggested next message, the pattern ticket 06 established: structured content now, that RDS-30 deepens into real drafting and send flows. */
export function CandidateOutreachSection({ outreach }: { outreach: RecruiterOutreachScaffold }) {
  const tone = CHIP_TONES[STATUS_TONE[outreach.status]];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Outreach</CardTitle>
          <Chip label={outreach.status} dotClassName={tone.dot} className={tone.className} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {outreach.touches.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {outreach.touches.map((touch) => {
              const Icon = CHANNEL_ICON[touch.channel];
              return (
                <li key={touch.id} className="flex items-start gap-2 text-sm">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-foreground">{touch.summary}</span>
                    <span className="text-xs text-muted-foreground">
                      {touch.channel} · {touch.sentAt} · {touch.responded ? "Responded" : "No response yet"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No outreach sent yet.</p>
        )}

        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Suggested next message</p>
          <p className="text-sm text-foreground">{outreach.suggestedNextMessage}</p>
        </div>
      </CardContent>
    </Card>
  );
}
