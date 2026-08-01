"use client";

import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";

const STAGES = ["Sourced", "Screening", "Interview", "Offer", "Hired"];

/**
 * Both sides of the table (brief section 6): recruiter mode noted, not
 * rebuilt here, one quiet section rather than a second product tour.
 */
export function RecruiterSection() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-6 py-16 text-center">
      <ScrollReveal className="flex flex-col items-center gap-3">
        <Badge variant="secondary" className="gap-1.5">
          <Users className="size-3" />
          Recruiter mode
        </Badge>
        <h2 className="max-w-lg text-2xl leading-snug font-semibold tracking-tight text-foreground">
          Built for both sides of the table.
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          The same product, the same trust boundary, a recruiter&apos;s own pipeline discipline. A candidate on one side
          of OpenPath can be a real inbound name on the other.
        </p>
      </ScrollReveal>

      <ScrollReveal delayMs={120} className="flex flex-wrap items-center justify-center gap-1.5">
        {STAGES.map((stage, index) => (
          <span key={stage} className="flex items-center gap-1.5">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{stage}</span>
            {index < STAGES.length - 1 ? <span className="text-muted-foreground/50">/</span> : null}
          </span>
        ))}
      </ScrollReveal>
    </section>
  );
}
