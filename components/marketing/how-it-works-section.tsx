"use client";

import { GitCompare, Radar, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ScrollReveal } from "@/components/marketing/scroll-reveal";

interface Beat {
  icon: LucideIcon;
  label: string;
  headline: string;
  copy: string;
}

// The three beats mirror docs/architecture.md section 1's product intent
// directly: organize and understand, decide what's next, build long-term
// career memory and direction. The page architecture mirrors the product
// architecture (brief's own instruction), not a separate marketing story.
const BEATS: Beat[] = [
  {
    icon: Radar,
    label: "Understand",
    headline: "See the signal, not just the listing.",
    copy: "OpenPath reads opportunities, connected sources, and your own history, then judges fit in the open: strengths, concerns, unknowns.",
  },
  {
    icon: GitCompare,
    label: "Decide",
    headline: "Know what to do next.",
    copy: "Next actions with a reason, side-by-side comparison, and a weekly strategy read turn a pile of maybes into one clear move.",
  },
  {
    icon: TrendingUp,
    label: "Grow",
    headline: "Turn work into proof, and proof into a path.",
    copy: "Rewind captures what you actually did this week. The roadmap turns your target direction into a staged, concrete plan.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="mx-auto flex w-full max-w-6xl scroll-mt-6 flex-col gap-12 px-6 py-16">
      <ScrollReveal className="flex flex-col gap-2 text-center">
        <span className="text-section-label mx-auto">How it works</span>
        <h2 className="mx-auto max-w-xl text-3xl leading-[1.15] font-semibold tracking-tight text-foreground">
          One system, three moves.
        </h2>
      </ScrollReveal>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {BEATS.map((beat, index) => (
          <ScrollReveal key={beat.label} delayMs={index * 120} className="flex flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/8">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <beat.icon className="size-4" />
            </span>
            <span className="text-section-label">{beat.label}</span>
            <h3 className="text-base font-semibold text-foreground">{beat.headline}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{beat.copy}</p>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
