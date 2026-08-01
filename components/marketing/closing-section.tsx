"use client";

import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { OpenOpenPathButton } from "@/components/marketing/open-openpath-button";

/**
 * Serial Position's other end (brief section 6): the closing line lands
 * the same thesis the hero opened with, then the one primary CTA again,
 * never a different or competing action.
 */
export function ClosingSection() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-7 px-6 py-24 text-center">
      <ScrollReveal className="flex flex-col items-center gap-3">
        <h2 className="text-3xl leading-[1.15] font-semibold tracking-tight text-foreground lg:text-4xl">
          Your career deserves an operating system. Open it.
        </h2>
      </ScrollReveal>
      <ScrollReveal delayMs={120}>
        <OpenOpenPathButton className="h-11 px-6 text-base" />
      </ScrollReveal>
    </section>
  );
}
