import { Mail, MessageCircle, Phone, StickyNote } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { OutreachDraftCard } from "@/components/recruiter/outreach-draft-card";
import { getRecruiterOutreachDrafts } from "@/lib/recruiter-outreach-utils";
import type { RecruiterCandidate, RecruiterOutreach, RecruiterOutreachChannel, RecruiterRole } from "@/lib/types";

const CHANNEL_ICON: Record<RecruiterOutreachChannel, typeof Mail> = {
  Email: Mail,
  LinkedIn: MessageCircle,
  Phone: Phone,
  "Internal note": StickyNote,
};

const STATUS_TONE: Record<RecruiterOutreach["status"], keyof typeof CHIP_TONES> = {
  "Not started": "neutral",
  "Awaiting reply": "warning",
  Responded: "success",
};

/**
 * The touch log plus a set of scripted, editable drafts for the common
 * recruiting moments (RDS-989): screening invite, interview scheduling, a
 * nudge to a slow hiring manager, the respectful close.
 */
export function CandidateOutreachSection({ candidate, role }: { candidate: RecruiterCandidate; role: RecruiterRole | undefined }) {
  const outreach = candidate.outreach;
  const tone = CHIP_TONES[STATUS_TONE[outreach.status]];
  const drafts = getRecruiterOutreachDrafts(candidate, role);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Outreach</CardTitle>
          <Chip label={outreach.status} dotClassName={tone.dot} className={tone.className} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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

        <div className="flex flex-col gap-2">
          <p className="text-section-label">Drafts</p>
          <div className="flex flex-col gap-2">
            {drafts.map((draft) => (
              <OutreachDraftCard key={draft.id} candidate={candidate} draft={draft} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
