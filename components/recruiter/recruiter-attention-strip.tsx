"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { getRecruiterAttentionItems } from "@/lib/recruiter-utils";
import { today } from "@/lib/store";
import type { RecruiterCandidate } from "@/lib/types";

/**
 * Up to 3 Copilot-flagged candidates, one line each, at the top of the
 * pipeline: Serial Position (this renders first, before the board), Miller's
 * Law (capped at 3), Progressive Disclosure (a reason line, the full picture
 * lives behind "open detail").
 */
export function RecruiterAttentionStrip({ candidates }: { candidates: RecruiterCandidate[] }) {
  const items = getRecruiterAttentionItems(candidates, today());
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-section-label">Needs attention today</p>
        <CopilotTag />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => {
          const candidate = candidates.find((entry) => entry.id === item.candidateId);
          if (!candidate) return null;
          return (
            <Link key={item.candidateId} href={`/recruiter/candidates/${candidate.id}`} className="block">
              <Card size="sm" className="ring-foreground/8 h-full gap-1.5 hover:ring-foreground/20">
                <div className="flex flex-col gap-1.5 px-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <AlertTriangle className="size-3.5" />
                    </span>
                    <span className="text-sm font-medium text-foreground">{candidate.name}</span>
                  </div>
                  <p className="pl-8 text-xs text-muted-foreground">{item.reason}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
