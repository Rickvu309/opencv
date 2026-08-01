"use client";

import { Eye, PenLine, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CopilotTag } from "@/components/shared/copilot-tag";

interface Principle {
  icon: LucideIcon;
  line: string;
}

const PRINCIPLES: Principle[] = [
  { icon: PenLine, line: "It drafts, you decide. Nothing AI-generated applies itself." },
  { icon: Eye, line: "Every claim shows its evidence, a real source, never hidden grounding." },
  { icon: ShieldCheck, line: "Honest uncertainty. Copilot names its confidence instead of faking certainty." },
];

/**
 * The trust boundary as a selling point (brief section 5): compact and
 * confident, no five-beat card here, just the rule stated plainly plus the
 * one real indigo-tagged element (CopilotTag) that ties the claim back to
 * the actual product convention rather than a marketing-only color choice.
 */
export function AiDifferenceSection() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <ScrollReveal className="flex flex-col items-center gap-3 text-center">
        <CopilotTag />
        <h2 className="max-w-lg text-3xl leading-[1.15] font-semibold tracking-tight text-foreground">
          It drafts. You decide.
        </h2>
      </ScrollReveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PRINCIPLES.map((principle, index) => (
          <ScrollReveal key={principle.line} delayMs={index * 100} className="flex flex-col items-center gap-2.5 text-center">
            <principle.icon className="size-5 text-muted-foreground" />
            <p className="text-sm leading-relaxed text-muted-foreground">{principle.line}</p>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delayMs={320} className="flex flex-wrap items-center justify-center gap-2">
        <ConfidenceChip confidence="High" />
        <ConfidenceChip confidence="Medium" />
        <ConfidenceChip confidence="Low" />
      </ScrollReveal>
    </section>
  );
}
