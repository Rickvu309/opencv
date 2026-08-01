"use client";

import { ScrollReveal } from "@/components/marketing/scroll-reveal";

const PROBLEM_LINES = [
  "A spreadsheet holds rows. It loses your context the moment you close the tab.",
  "A generic AI tool guesses at fit. It doesn't know your history, only your prompt.",
  "Every application starts your proof from zero. What you already accomplished evaporates.",
];

/**
 * Beat 2 of the page's one narrative: the problem, stated tight (3 lines,
 * Miller's Law), then the thesis that sets up every section below it.
 */
export function ProblemThesisSection() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-3">
        {PROBLEM_LINES.map((line, index) => (
          <ScrollReveal key={line} delayMs={index * 90}>
            <p className="text-lg leading-snug text-muted-foreground">{line}</p>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delayMs={280}>
        <p className="text-2xl leading-snug font-semibold tracking-tight text-foreground">
          Your career deserves an operating system, not another list.
        </p>
      </ScrollReveal>
    </section>
  );
}
